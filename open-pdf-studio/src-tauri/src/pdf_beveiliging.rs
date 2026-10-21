//! Een PDF beveiligen met een wachtwoord: het standaard beveiligingsmechanisme
//! uit de PDF 2.0-norm (ISO 32000-2, Standard Security Handler, V 5 / R 6, AES-256).
//! Acrobat, Voorvertoning, Chrome en pdf.js openen zo'n bestand met het wachtwoord.
//!
//! - Gebruikerswachtwoord ("openen"): zonder dat opent het bestand niet. Leeg =
//!   het bestand opent vrij en alleen de rechten gelden.
//! - Eigenaarwachtwoord ("rechten"): met dit wachtwoord gelden de beperkingen
//!   niet. Leeg = het wordt een willekeurig wachtwoord dat niemand kent.
//!
//! lopdf leest het bestand in (ook objectstromen: die worden losse objecten) en
//! schrijft het weer weg; hier worden alleen de tekenreeksen en streams
//! versleuteld en het /Encrypt-woordenboek toegevoegd.

use aes::cipher::{BlockEncrypt, KeyInit as _};
use cbc::cipher::{block_padding::{NoPadding, Pkcs7}, BlockEncryptMut, KeyIvInit};
use lopdf::{Dictionary, Document, Object, ObjectId, StringFormat};
use rand::RngCore;
use sha2::{Digest, Sha256, Sha384, Sha512};

type Aes256CbcEnc = cbc::Encryptor<aes::Aes256>;
type Aes128CbcEnc = cbc::Encryptor<aes::Aes128>;

/// Wat het ontvangende programma mag doen. Alles uit = alleen lezen.
#[derive(Debug, Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Rechten {
    pub print: bool,
    pub print_hoge_kwaliteit: bool,
    pub wijzigen: bool,
    pub kopieren: bool,
    pub annoteren: bool,
    pub formulieren: bool,
    pub samenstellen: bool,
    pub toegankelijkheid: bool,
}

impl Default for Rechten {
    fn default() -> Self {
        Rechten {
            print: true,
            print_hoge_kwaliteit: true,
            wijzigen: true,
            kopieren: true,
            annoteren: true,
            formulieren: true,
            samenstellen: true,
            toegankelijkheid: true,
        }
    }
}

impl Rechten {
    /// De /P-waarde (ISO 32000-2, tabel 22): bits 7, 8 en 13-32 staan aan,
    /// bits 1 en 2 uit; de rest volgt de rechten.
    pub fn bits(&self) -> i32 {
        let mut p: u32 = 0xFFFF_F0C0;
        let mut zet = |aan: bool, bit: u32| {
            if aan {
                p |= 1 << (bit - 1);
            }
        };
        zet(self.print, 3);
        zet(self.wijzigen, 4);
        zet(self.kopieren, 5);
        zet(self.annoteren, 6);
        zet(self.formulieren, 9);
        zet(self.toegankelijkheid, 10);
        zet(self.samenstellen, 11);
        zet(self.print_hoge_kwaliteit, 12);
        p as i32
    }
}

fn wachtwoord_bytes(w: &str) -> Vec<u8> {
    let mut b = w.as_bytes().to_vec();
    b.truncate(127);
    b
}

/// Algoritme 2.B (ISO 32000-2): de wachtwoordhash van revisie 6.
fn hash_r6(wachtwoord: &[u8], zout: &[u8], udata: &[u8]) -> [u8; 32] {
    let mut k: Vec<u8> = {
        let mut h = Sha256::new();
        h.update(wachtwoord);
        h.update(zout);
        h.update(udata);
        h.finalize().to_vec()
    };
    let mut i: usize = 0;
    loop {
        let mut k1 = Vec::with_capacity((wachtwoord.len() + k.len() + udata.len()) * 64);
        for _ in 0..64 {
            k1.extend_from_slice(wachtwoord);
            k1.extend_from_slice(&k);
            k1.extend_from_slice(udata);
        }
        let e = Aes128CbcEnc::new_from_slices(&k[0..16], &k[16..32])
            .expect("sleutel en iv zijn 16 bytes")
            .encrypt_padded_vec_mut::<NoPadding>(&k1);
        let modulo = e[..16].iter().map(|b| *b as u32).sum::<u32>() % 3;
        k = match modulo {
            0 => Sha256::digest(&e).to_vec(),
            1 => Sha384::digest(&e).to_vec(),
            _ => Sha512::digest(&e).to_vec(),
        };
        let laatste = *e.last().expect("e is niet leeg") as usize;
        i += 1;
        if i >= 64 && laatste <= i - 32 {
            break;
        }
    }
    let mut uit = [0u8; 32];
    uit.copy_from_slice(&k[..32]);
    uit
}

/// AES-256-CBC zonder opvulling, iv nul (voor UE en OE: één of twee blokken).
fn aes256_cbc_nul_iv(sleutel: &[u8; 32], data: &[u8]) -> Vec<u8> {
    Aes256CbcEnc::new_from_slices(sleutel, &[0u8; 16])
        .expect("sleutel is 32 bytes, iv 16")
        .encrypt_padded_vec_mut::<NoPadding>(data)
}

/// De bestandssleutel plus de waarden voor het /Encrypt-woordenboek.
struct Sleutels {
    bestand: [u8; 32],
    u: Vec<u8>,
    ue: Vec<u8>,
    o: Vec<u8>,
    oe: Vec<u8>,
    perms: Vec<u8>,
}

fn maak_sleutels(gebruiker: &str, eigenaar: &str, p: i32, rng: &mut impl RngCore) -> Sleutels {
    let mut bestand = [0u8; 32];
    rng.fill_bytes(&mut bestand);

    let gw = wachtwoord_bytes(gebruiker);
    let mut ew = wachtwoord_bytes(eigenaar);
    if ew.is_empty() {
        // Geen eigenaarwachtwoord: een willekeurig, onbekend wachtwoord, zodat
        // niemand de rechten met een leeg wachtwoord kan omzeilen.
        let mut w = [0u8; 16];
        rng.fill_bytes(&mut w);
        ew = w.iter().map(|b| b"abcdefghijklmnopqrstuvwxyz0123456789"[(*b as usize) % 36]).collect();
    }

    let mut u_val_zout = [0u8; 8];
    let mut u_sleutel_zout = [0u8; 8];
    rng.fill_bytes(&mut u_val_zout);
    rng.fill_bytes(&mut u_sleutel_zout);
    let mut u = hash_r6(&gw, &u_val_zout, &[]).to_vec();
    u.extend_from_slice(&u_val_zout);
    u.extend_from_slice(&u_sleutel_zout);
    let ue = aes256_cbc_nul_iv(&hash_r6(&gw, &u_sleutel_zout, &[]), &bestand);

    let mut o_val_zout = [0u8; 8];
    let mut o_sleutel_zout = [0u8; 8];
    rng.fill_bytes(&mut o_val_zout);
    rng.fill_bytes(&mut o_sleutel_zout);
    let mut o = hash_r6(&ew, &o_val_zout, &u).to_vec();
    o.extend_from_slice(&o_val_zout);
    o.extend_from_slice(&o_sleutel_zout);
    let oe = aes256_cbc_nul_iv(&hash_r6(&ew, &o_sleutel_zout, &u), &bestand);

    // /Perms: P (4 bytes, little endian), 0xFFFFFFFF, 'T' (metadata versleuteld),
    // "adb" en vier willekeurige bytes, met AES-256-ECB onder de bestandssleutel.
    let mut blok = [0u8; 16];
    blok[0..4].copy_from_slice(&p.to_le_bytes());
    blok[4..8].copy_from_slice(&[0xFF; 4]);
    blok[8] = b'T';
    blok[9..12].copy_from_slice(b"adb");
    rng.fill_bytes(&mut blok[12..16]);
    let aes = aes::Aes256::new_from_slice(&bestand).expect("sleutel is 32 bytes");
    let mut b = aes::cipher::generic_array::GenericArray::clone_from_slice(&blok);
    aes.encrypt_block(&mut b);
    let perms = b.to_vec();

    Sleutels { bestand, u, ue, o, oe, perms }
}

/// Eén tekenreeks of stream: AES-256-CBC met een willekeurige iv voorop, PKCS#7.
fn versleutel_bytes(sleutel: &[u8; 32], data: &[u8], rng: &mut impl RngCore) -> Vec<u8> {
    let mut iv = [0u8; 16];
    rng.fill_bytes(&mut iv);
    let versleuteld = Aes256CbcEnc::new_from_slices(sleutel, &iv)
        .expect("sleutel is 32 bytes, iv 16")
        .encrypt_padded_vec_mut::<Pkcs7>(data);
    let mut uit = Vec::with_capacity(16 + versleuteld.len());
    uit.extend_from_slice(&iv);
    uit.extend_from_slice(&versleuteld);
    uit
}

fn versleutel_object(obj: &mut Object, sleutel: &[u8; 32], rng: &mut impl RngCore) {
    match obj {
        Object::String(bytes, _) => {
            *bytes = versleutel_bytes(sleutel, bytes, rng);
        }
        Object::Array(items) => {
            for item in items.iter_mut() {
                versleutel_object(item, sleutel, rng);
            }
        }
        Object::Dictionary(dict) => versleutel_woordenboek(dict, sleutel, rng),
        Object::Stream(stream) => {
            versleutel_woordenboek(&mut stream.dict, sleutel, rng);
            stream.content = versleutel_bytes(sleutel, &stream.content, rng);
            let lengte = stream.content.len() as i64;
            stream.dict.set("Length", lengte);
        }
        _ => {}
    }
}

fn versleutel_woordenboek(dict: &mut Dictionary, sleutel: &[u8; 32], rng: &mut impl RngCore) {
    for (_, waarde) in dict.iter_mut() {
        versleutel_object(waarde, sleutel, rng);
    }
}

/// Het /Encrypt-woordenboek (V 5, R 6, AESV3).
fn encrypt_woordenboek(s: &Sleutels, p: i32) -> Dictionary {
    let mut std_cf = Dictionary::new();
    std_cf.set("AuthEvent", Object::Name(b"DocOpen".to_vec()));
    std_cf.set("CFM", Object::Name(b"AESV3".to_vec()));
    std_cf.set("Length", 32i64);
    let mut cf = Dictionary::new();
    cf.set("StdCF", Object::Dictionary(std_cf));

    let hex = |b: &[u8]| Object::String(b.to_vec(), StringFormat::Hexadecimal);
    let mut d = Dictionary::new();
    d.set("Filter", Object::Name(b"Standard".to_vec()));
    d.set("V", 5i64);
    d.set("R", 6i64);
    d.set("Length", 256i64);
    d.set("CF", Object::Dictionary(cf));
    d.set("StmF", Object::Name(b"StdCF".to_vec()));
    d.set("StrF", Object::Name(b"StdCF".to_vec()));
    d.set("O", hex(&s.o));
    d.set("U", hex(&s.u));
    d.set("OE", hex(&s.oe));
    d.set("UE", hex(&s.ue));
    d.set("Perms", hex(&s.perms));
    d.set("P", p as i64);
    d
}

/// Versleutelt `bytes` (een niet-beveiligde PDF) met de gegeven wachtwoorden.
pub fn beveilig_pdf(
    bytes: &[u8],
    gebruikerswachtwoord: &str,
    eigenaarwachtwoord: &str,
    rechten: &Rechten,
) -> Result<Vec<u8>, String> {
    let mut doc = Document::load_mem(bytes).map_err(|e| format!("Kan de PDF niet lezen: {e}"))?;
    if doc.is_encrypted() {
        return Err("Deze PDF is al beveiligd.".into());
    }
    let mut rng = rand::rngs::OsRng;
    let p = rechten.bits();
    let sleutels = maak_sleutels(gebruikerswachtwoord, eigenaarwachtwoord, p, &mut rng);

    let ids: Vec<ObjectId> = doc.objects.keys().copied().collect();
    for id in ids {
        if let Some(obj) = doc.objects.get_mut(&id) {
            versleutel_object(obj, &sleutels.bestand, &mut rng);
        }
    }

    let encrypt_id = doc.add_object(Object::Dictionary(encrypt_woordenboek(&sleutels, p)));
    doc.trailer.set("Encrypt", Object::Reference(encrypt_id));
    if doc.trailer.get(b"ID").is_err() {
        let mut id = [0u8; 16];
        rng.fill_bytes(&mut id);
        let s = Object::String(id.to_vec(), StringFormat::Hexadecimal);
        doc.trailer.set("ID", Object::Array(vec![s.clone(), s]));
    }
    doc.version = "2.0".into();

    let mut uit = Vec::with_capacity(bytes.len() + 4096);
    doc.save_to(&mut uit).map_err(|e| format!("Kan de PDF niet schrijven: {e}"))?;
    Ok(uit)
}

/// Leest `bron`, beveiligt het en schrijft het naar `doel`.
#[tauri::command]
pub async fn protect_pdf_file(
    bron: String,
    doel: String,
    gebruikerswachtwoord: String,
    eigenaarwachtwoord: String,
    rechten: Rechten,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        if gebruikerswachtwoord.is_empty() && eigenaarwachtwoord.is_empty() {
            return Err("Vul minstens één wachtwoord in.".to_string());
        }
        let bytes = std::fs::read(&bron).map_err(|e| format!("Kan {bron} niet lezen: {e}"))?;
        let uit = beveilig_pdf(&bytes, &gebruikerswachtwoord, &eigenaarwachtwoord, &rechten)?;
        std::fs::write(&doel, uit).map_err(|e| format!("Kan {doel} niet schrijven: {e}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rechten_bits_alles_aan_is_de_standaardwaarde() {
        assert_eq!(Rechten::default().bits() as u32, 0xFFFF_FFFC);
    }

    #[test]
    fn rechten_bits_alleen_lezen() {
        let r = Rechten {
            print: false, print_hoge_kwaliteit: false, wijzigen: false, kopieren: false,
            annoteren: false, formulieren: false, samenstellen: false, toegankelijkheid: false,
        };
        assert_eq!(r.bits() as u32, 0xFFFF_F0C0);
        let alleen_print = Rechten { print: true, ..r };
        assert_eq!(alleen_print.bits() as u32 & 0x4, 0x4);
    }

    #[test]
    fn hash_r6_is_deterministisch_en_32_bytes() {
        let a = hash_r6(b"geheim", b"zoutzout", &[]);
        let b = hash_r6(b"geheim", b"zoutzout", &[]);
        let c = hash_r6(b"ander", b"zoutzout", &[]);
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    /// Handmatig: PDF_IN, PDF_OUT, PDF_USER en PDF_OWNER uit de omgeving; het
    /// resultaat wordt daarna met een ander programma (poppler, pdfium) gecontroleerd.
    #[test]
    #[ignore]
    fn beveilig_bestand_uit_omgeving() {
        let invoer = std::env::var("PDF_IN").expect("PDF_IN");
        let uitvoer = std::env::var("PDF_OUT").expect("PDF_OUT");
        let gebruiker = std::env::var("PDF_USER").unwrap_or_default();
        let eigenaar = std::env::var("PDF_OWNER").unwrap_or_default();
        let rechten = Rechten {
            print: std::env::var("PDF_NOPRINT").is_err(),
            kopieren: std::env::var("PDF_NOCOPY").is_err(),
            ..Rechten::default()
        };
        let bytes = std::fs::read(invoer).unwrap();
        let uit = beveilig_pdf(&bytes, &gebruiker, &eigenaar, &rechten).unwrap();
        std::fs::write(uitvoer, uit).unwrap();
    }
}
