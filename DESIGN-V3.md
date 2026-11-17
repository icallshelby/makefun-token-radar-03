# token-radar-01 v3 — DESIGN (radar-4: size curve + blind test + netted farm)

Status: DESAIN SAJA — 17 Nov 2026 ~01:15 WIB. Belum build, belum submit.
Alasan: kuota Gemini habis sampai reset ±15:00 WIB 17 Nov; bundle make.fun WAJIB dari sesi
Gemini CLI. Dokumen ini supaya pas kuota balik, build tinggal eksekusi.

## 1. Fakta papan (terverifikasi 17 Nov 2026 00:54–01:12 WIB, dari /tmp/lb-radar.json)

- Kompetisi token-radar-01, hadiah $1.325 (juara 1 $1.000), prize top 10, deadline 14 Des 2026.
- Standing entry kita v2 (01a1de8f-9b2d, "Token Radar v2", dev 0.552362): **rank 5803/6527**,
  judge W3 D3 L6 dari 12 match, CI [0.496, 0.609], bytes 896.775.
- v1 (01a1ddab-cac4, dev 0.667843) **tidak ada lagi di papan** (exact-match 0): papan hanya
  menampilkan submission terakhir per akun (Force_Last). v1 ketiban v2.
- Top 1–5 (judge win_rate_micro, 20 match, semua 20W/0D/0L — angka 0.962 adalah estimasi
  yang di-shrink, bukan 20/20 mentah):
  #1 nightshift-labs 0.962052 · #2 calm-owl-82 0.962052 · #3 ronigrv 0.961255 ·
  #4 tidy-meteor-25 0.961255 · #5 sprydd 0.958843. Bytes top 1–5: 1,25–1,53 MB (kita 0,90 MB).
- **Medan sangat padat di atas: 1.807 entry ≥ 0.9; 4.420 ≥ 0.8.** Bar top 10 ≈ 0.959.
  Entry di atas v1 (0.668): 5.368. Entry di atas v2 (0.552): 5.797.
- Source code semua entry lain WITHHELD (sourceWithheld=true). Semua pola di bawah ini
  dibaca dari JUDUL + handle + skor yang terlihat — TIDAK PERNAH diklaim sebagai isi source
  mereka. Judul bukan bukti isi; yang diyakini adalah klaster pola yang berulang di top 15.

## 2. Bedah v2: kenapa 0.5524 < v1 0.6678 (REGRESI, bukan progres)

Fakta:
- Satu-satunya perubahan model v1 → v2 adalah multiple: flat 0.30 (radar-2) → median
  per-kategori, min-n 5 + fallback global, clamp [0.03, 0.80] (radar-3). Plus dashboard:
  kolom Multiple + tabel kalibrasi + comps bernama per kategori.
- Dampak terukur (DESIGN-V2): Spearman vs v1 0.966, 186/198 baris pindah rank (median |move| 5,
  maks 72), top-10 churn 3 nama. Top-5 v2: steakhouse-financial $650 jt, sentora-curator
  $584 jt, gauntlet $393 jt, veda $352 jt, usdd $217 jt. Keluar dari top-10 v1:
  cian-yield-layer, polymarket-international, rockawayx.
- Skor jatuh 0.668 → 0.552 (−0.116, ~400+ rank lebih buruk).

Hipotesis utama (alasan judge kosong di record — `reasons: []` — jadi ini hipotesis, bukan fakta):
- Median per-kategori menggelembungkan kategori bermultiple tinggi (Basis Trading 0.654,
  Canonical Bridge 0.746, Bridge 0.557) sehingga puncak board diisi nama yang sebagai
  kandidat launch token terlihat kurang meyakinkan (mis. USDD stablecoin, risk curator),
  sementara v1 yang flat menaruh nama launch yang lebih masuk akal di atas.
- Median adalah statistik yang rapuh: satu kategori hanya diwakili segelintir comps, dan
  median tidak memakai informasi ukuran (protokol TVL $2 miliar diperlakukan sama dengan
  TVL $50 juta). Judge pairwise membandingkan dashboard — board yang puncaknya terasa
  "salah" kalah, betapapun rapi tabel kalibrasinya.
- Pelajaran yang dibawa ke v3: **jangan ubah multiple lagi tanpa bukti held-out.**
  Setiap klaim model harus dibuktikan dengan tes buta DI DALAM dashboard, dan build
  berhenti kalau model baru kalah di tesnya sendiri.

Kelemahan v2 lain yang terlihat dari perbandingan pola top (bukan dari skor):
- v2 TIDAK PUNYA tes out-of-sample / blind sama sekali — kalibrasi memakai semua 128 comps
  in-sample. Ini satu-satunya lubang terbesar vs top 1–15 (lihat §3).
- Farm plan v2 TIDAK dinet-kan: step-step punya perkiraan biaya gas + principal ($50–250)
  tapi tidak ada total biaya $, tidak ada nilai airdrop ekspektasian, tidak ada net, tidak
  ada verdict. Top entries semuanya menampilkan ekonomi farm yang dinet-kan.
- v2 TIDAK PUNYA ketidakpastian: implied value satu angka pasti, tanpa band. Top #10/#13
  menampilkan bootstrap bands / stability check.
- v2 TIDAK PUNYA kurva: multiple flat per kategori, tidak ada hubungan ukuran → nilai.
  Top #7/#10/#13/#14/#15 semuanya memakai size curve.
- Dashboard v2 sudah menampilkan kalibrasi + comps bernama (temuan review XingChi #1 sudah
  diimplementasikan di model.ts: `comps: {name, ratio}[]`) — bagian ini DIPERTAHANKAN.

## 3. Studi top 1–5 (+ pola top 6–15)

Judul lengkap top 5 (verbatim dari leaderboard):
1. nightshift-labs — "Launchscope — pre-token radar: the fitted model and its out-of-sample
   test on the board, traded tokens as anchors, costed farm timelines"
2. calm-owl-82 — "Launch Radar: comps curve tested blind, costed farm plan for every
   pre-token protocol"
3. ronigrv — "Launch Radar: comps-fitted value tested out of sample, every farm plan netted
   to farm, thin or skip"
4. tidy-meteor-25 — "Launch Radar" (judul polos, tetap #4 — BUKTI judul bukan yang menang;
   yang menang isi dashboard + modelnya)
5. sprydd — "Launch Ledger: comps-calibrated radar, 192 pre-token protocols, 40/40 watchlist"

Pola top 6–15 (judul, diringkas):
- #6 fikril07: "priced off the 92 tokens that already trade, farm plans netted at the band's
  low end"
- #7 sudhan: "one model prices board and page, size curve tested blind, 8-step farm plans
  netted to the dollar"
- #8 gentle-badger-68: "198 pre-token protocols priced off the snapshot's own 93 token families"
- #9 tiar: "research note, mechanism-aware farm plans, backtested comparables"
- #10 elmatano6243: "time-split size curve, farm verdicts netted to the dollar, bootstrap
  stability check"
- #11 defalt: "comps-fitted value, OOS x2.01, 198 rows, farm economics"
- #13 gibran-garap-edrop: "clean-comps size curve, bootstrap bands, netted farm economics"
- #14 boge: "size curve fitted blind, every farm plan netted at the band's low end"
- #15 theresia-ai: "joint ridge comps tested blind, costed farm plans, 198 pre-token protocols"

Klaster pola pemenang (hitung kemunculan di top 15):
1. **Tes out-of-sample / blind terhadap model valuasi — 10+ dari 15** (#1, #2, #3, #7, #9,
   #10 time-split, #11 "OOS x2.01", #13, #14, #15). Ini pola DOMINAN dan v2 tidak punya.
2. **Farm economics yang dinet-kan / costed — 10 dari 15** (#1, #2, #3, #6, #7, #10, #11,
   #13, #14, #15). Bukan sekadar langkah farm, tapi nilai bersih dalam dolar.
3. **Size curve (log-log mcap vs TVL), bukan multiple flat — 6 dari 15** (#7, #10, #13, #14,
   #15, #2 "comps curve").
4. **Bootstrap bands / stability check — 2 eksplisit** (#10, #13) + #6/#14 "netted at the
   band's low end" (menyiratkan band).
5. **Verdict eksplisit per baris — 2 eksplisit** (#3 "thin or skip", #10 "farm verdicts").
6. **Mekanisme bernama + angka** ("92 tokens", "93 token families", "198 rows", "40/40",
   "8-step", "OOS x2.01") — angka spesifik, bukan klaim generik.

## 4. Konsep v3 — radar-4 (GESERAN dari pola top, BUKAN copy)

Satu kalimat: **size curve berjangkar kategori + tes buta dua lapis + ekonomi farm yang
dinet-kan di ujung bawah band bootstrap, dengan verdict FARM/THIN/SKIP per baris.**

Geserannya vs top entries (kenapa ini bukan copy):
- Top entries memakai size curve GLOBAL atau flat median kategori. v3 memakai **size curve
  dengan intercept per kategori** (kurva global + geseran kategori dari median residual
  comps kategori itu) — hibrida yang tidak dideskripsikan judul top mana pun.
- Top entries menampilkan SATU angka OOS ("OOS x2.01"). v3 menampilkan **tabel ablasi**:
  tiga model (flat global / median kategori = radar-3 / size curve radar-4) × dua split
  (time-split + random 80/20) + ablasi priors (dengan/tanpa growth-maturity-breadth).
  Judge melihat BUKTI perbandingan, bukan satu angka klaim.
- Top entries men-net-kan farm di "low end band". v3 men-net-kan di low end band bootstrap
  p10 DAN menampilkan ledger biaya per langkah (tiap step dengan $) — jejak audit penuh,
  bukan satu angka net.
- Semua angka (kurva, OOS, band, net) dihitung SAAT RUNTIME dari snapshot — tidak ada satu
  pun angka yang di-hardcode. Kalau snapshot berubah, semua angka ikut berubah.

## 5. Spesifikasi model radar-4 (untuk sesi build — implementable)

### 5.1 Comps (sama seperti v2, dipertahankan)
- Tokenized protocols dengan mcap_usd > 0 DAN tvl_usd > 0 (n=128 di sealed snapshot).
  15 baris mcap==0 tetap DIKELUARKAN (missing-data zeros, bukan valuasi).

### 5.2 Size curve (pengganti multiple flat)
- Fit OLS log10(mcap) = a + b·log10(TVL) pada comps (global).
- Intercept kategori: untuk kategori dengan n≥5 comps, shift = median residual
  (log10(mcap_aktual) − log10(mcap_prediksi_kurva)) comps kategori itu, di-clamp ke
  [−0.30, +0.30] dex. Kategori n<5 → shift 0 (pakai kurva global).
- implied_curve = 10^(a + b·log10(TVL) + shift_kategori).
- Guard: implied akhir tetap di-clamp ke multiple TVL [0.03, 0.80] (guard yang sama
  seperti v2) — tidak ada blowup outlier.

### 5.3 Priors (growth/maturity/breadth dari v2) — DIPERTAHANKAN SEMENTARA, diuji ablasi
- Rumus growth/maturity/breadth TIDAK BERUBAH dari radar-2/3 (konstanta MODEL sama).
- Aturan build: OOS test membandingkan size curve + priors vs size curve TANPA priors.
  **Kalau priors memperburuk held-out error, build HARUS membuang priors** (bukan
  mempertahankan karena "sudah ada"). Keputusan mengikuti bukti, bukan dokumen ini.

### 5.4 Tes buta / out-of-sample (WAJIB tampil di dashboard)
- Split 1 — time-split: latih pada comps dengan listed_at SEBELUM median listed_at
  comps; uji pada comps SETELAH median. (Menguji apakah model memprediksi token yang
  lahir belakangan — analog #10 "time-split".)
- Split 2 — random 80/20: seed TETAP yang diturunkan dari string as_of snapshot
  (deterministik; tidak ada Date.now()/Math.random() tak berseed).
- Metrik: median |log10(pred/actual)| → laporkan sebagai "within ×F median"
  (F = 10^median_abs_log_err) + n uji. Bandingkan 3 model: (a) flat global median,
  (b) median kategori (radar-3), (c) radar-4 (dengan + tanpa priors).
- Tabel OOS tampil di dashboard ("How we know the model works") + ringkasan satu baris
  di header board ("blind-tested: within ×F on tokens the model never saw").

### 5.5 Bootstrap bands (ketidakpastian per baris)
- 200 resample comps dengan replacement, PRNG berseed tetap (mulberry32, seed dari hash
  string as_of). Tiap resample: refit kurva + refit shift kategori, hitung ulang implied
  tiap baris. Band per baris = [p10, p90]. Simpan low/high per baris di board.json.
- Verdict farm memakai ujung BAWAH band (low), seperti pola #6/#14.

### 5.6 Ekonomi farm yang dinet-kan + verdict (per baris)
- Biaya farm per baris = Σ biaya langkah (gas per-chain dalam USD — TABEL ASUMSI yang
  didokumentasikan di kode + dashboard, mis. ETH $2/tx, SOL $0.05, BNB $0.15, dst.,
  DITULIS sebagai asumsi bertanggal, bukan data snapshot) + opportunity cost principal
  (5% APR × hold_days/365).
- Nilai airdrop ekspektasian = implied_LOW × 5% (asumsi didokumentasikan: "5% FDV untuk
  farmer — alokasi airdrop yang umum; ubah di model, board ikut berubah").
- Net = nilai ekspektasian − biaya farm. Verdict: FARM jika net ≥ $100; THIN jika
  $0 ≤ net < $100; SKIP jika net < 0.
- Board mendapat kolom "Net farm $" dan "Verdict" (chip FARM/THIN/SKIP). Detail drawer
  mendapat farm ledger: tiap langkah + $ biayanya, total biaya, nilai ekspektasian, net,
  verdict + alasannya.

### 5.7 Determinisme (keras)
- Tanpa Date.now(), tanpa Math.random() tak berseed, tanpa network. Semua "acak" dari
  PRNG berseed (seed dari as_of). Dua run main.ts ke dua direktori HARUS byte-identik
  (diff -r) — gate yang sama seperti v2.

### 5.8 Yang DIPERTAHANKAN dari v2
- 198 baris (verifikasi saat build), watchlist 40/40, aturan eligibility persis sama
  (house-exclusion: bridge/canonical bridge/liquid staking/restaking/CEX, wrapped/staked,
  versioned, exchange names).
- Comps bernama per kategori (`comps: {name, ratio}[]`) + tabel kalibrasi di dashboard.
- Farm steps 7 langkah per baris (3–12 diizinkan gate, 20–600 karakter per step).
- vendor/makefun-board.ts tidak disentuh; main.ts tidak berubah kecuali field baru
  yang diteruskan (additive).

## 6. Perubahan dashboard (yang dilihat judge)

- Board: kolom baru "Net farm $" + "Verdict"; kolom Multiple dipertahankan (sekarang
  menampilkan multiple efektif dari kurva, bukan median kategori); badge di header:
  "blind-tested within ×F (n=… held-out tokens)".
- Seksi baru "How we know the model works": tabel OOS (3 model × 2 split + ablasi priors)
  + satu kalimat interpretasi. Letak: tepat di atas board — judge membaca screenshot
  pertama, bukti harus terlihat tanpa scroll ke drawer.
- Grafik size curve: SVG inline statis (tanpa network) — scatter comps (log-log), garis
  kurva fitted, 10 baris teratas board di-plot sebagai titik. Satu gambar yang
  menjelaskan seluruh model.
- Detail drawer per baris: breakdown valuasi (nilai kurva → priors → implied + band
  [low–high]), comps bernama kategori, farm ledger lengkap (langkah + $ + total + net
  + verdict).
- Filter baru: verdict=FARM (selain filter kategori yang sudah ada).
- Screenshots (1440×900, masing-masing ≤512 KiB, DIBUKA dan DILIHAT sebelum selesai):
  (1) board — kolom Net + Verdict terlihat; (2) detail rank 1 — breakdown + ledger terlihat;
  (3) filtered verdict=FARM.
- Budget ukuran: dashboard total ≤100 KB (v2 36,9 KB; grafik + tabel menambah); data.js
  membesar sedikit karena band per baris — masih jauh di bawah batas dossier 4 MB.

## 7. Target verifikasi build (dihitung saat build, BUKAN di-hardcode di sini)

Clean-check script baru (check-radar-v3-clean.mjs, meniru pola v2) HARUS lolos semua:
- 198 baris, watchlist 40/40, rank 1..198, implied non-increasing, integer positif.
- Farm steps 3–12 per baris, 20–600 karakter.
- Band konsisten: low ≤ implied ≤ high untuk semua baris; verdict konsisten dengan net
  (FARM ⟺ net ≥ 100; THIN ⟺ 0 ≤ net < 100; SKIP ⟺ net < 0).
- Tabel OOS ada, semua faktor finite; **radar-4 mengalahkan radar-3 di KEDUA split**
  (time-split DAN random) — kalau tidak, BUILD BERHENTI dan lapor ke parent; jangan
  submit model yang kalah di tesnya sendiri. Fallback bila kurva kalah: kirim model
  OOS-terbaik apa pun itu (aturan "ship what the blind test crowns"), dan laporkan.
- Dua run byte-identik (diff -r). Dossier byte-match. Kit check 12/12 di fresh clone.
- Angka-angka yang baru diketahui saat build (dicatat ke SUBMISSION.md + SHIP-READY.md):
  koefisien kurva (a, b), OOS ×F per model per split, hasil ablasi priors, distribusi
  verdict (jumlah FARM/THIN/SKIP), top-5 baris baru.

## 8. Rencana build (eksekusi setelah kuota Gemini reset ±15:00 WIB 17 Nov)

- Repo baru: `icallshelby/makefun-token-radar-03` (pola per versi: v1 -01, v2 -02).
  Dibuat via browser SETELAH opening (opening 14 Nov — sudah lewat, aman). README +
  badges + About diisi sebelum submit (pelajaran fps-02: 422 repo_readme/repo_about).
- Sesi Gemini CLI (SATU sesi jalan dalam satu waktu; rotasi model 3.6-flash →
  3-flash-preview → 3.5-flash-lite; SELALU --yolo; JANGAN 3.1-pro (berbayar); JANGAN
  tulis kode sendiri dengan Muse — bundle harus Gemini-only):
  1. **Sesi model** — tulis ulang lib/model.ts → radar-4 (§5) + check-radar-v3-clean.mjs
     + verifikasi Python independen atas OOS/kurva/band dari snapshot lokal
     `~/workspace/makefun/token-radar-01-kit/token-radar-01-kit/input/snapshot.json`.
     JANGAN sentuh main.ts / vendor / dashboard di sesi ini.
  2. **Sesi dashboard** — index.html/app.js/app.css (§6) + re-shoot 3 screenshot +
     buka & lihat tiap screenshot. JANGAN sentuh lib/model.ts.
  3. **Sesi verify+repo** — clean check lolos, kit check 12/12 di fresh clone,
     README, git init + commit, bundle Gemini-only (`--no-muse-app`), verifikasi bundle
     HANYA berisi sesi Gemini. Tulis SHIP-READY.md. JANGAN submit (keputusan parent).
  4. **Submit (ronde terpisah, parent yang putuskan)** — cek kuota dulu (maks 5/hari,
     10 total; terpakai 2: v1 + v2). Intake verifikasi via API (status submitting,
     error null).
- Perkiraan: 3 sesi build + 1 submit ≈ 30–50 request Gemini. Cek kuota tiap sesi
  (bucket 20/hari/model; reset ±15:00 WIB).
- Catatan kuota: JANGAN pakai Gemini CLI sebelum reset 15:00 WIB — sisa <10 request
  di 3.5-flash-lite jangan dibuang untuk desain (desain ini sudah ditulis tanpa Gemini).

## 9. Risiko & yang TIDAK dilakukan

- Risiko terbesar: OOS test bisa menunjukkan size curve TIDAK lebih baik dari median
  kategori — maka headline v3 gugur. Mitigasi sudah di §7: ship model OOS-terbaik,
  laporkan apa adanya. Jangan memaksakan kurva yang kalah.
- Risiko kedua: judge pairwise AI tidak bisa ditebak dari judul — dev score baru diketahui
  SETELAH submit. v3 menargetkan klaster pola yang sama dengan 10+ top-15, tapi tidak
  ada jaminan menembus 0.959. Jangan janjikan menang; janjikan bukti yang lebih kuat
  dari v2.
- TIDAK dilakukan: copy judul/mekanisme top entry kata-per-kata; hardcode angka OOS/band/
  multiple; ubah eligibility (house-exclusion) untuk menambah baris; sentuh wallet,
  tanda tangan, atau submit apa pun di tahap ini.

## 10. Review independen (DeepSeek via 100milionseek, 17 Nov ~01:20 WIB)

Catatan kejujuran: review datang TERPOTONG (respons pertama kena cap 1500 token, berhenti
di tengah poin 2; dua upaya lanjutan gagal — sesi API stateless, lalu respons kosong).
Yang tercatat di bawah ini adalah poin 1 lengkap + poin 2 sebagian; **poin 3 tidak pernah
sampai**. Jangan diklaim review ini lengkap.

### Poin 1 — "Blind test"-nya bukan out-of-sample yang sesungguhnya (DITERIMA, perbaiki di build)
- Time-split + random 80/20 pada snapshot 128 baris yang SAMA adalah resampling, bukan tes
  buta — holdout berbagi vintage, universe-selection, dan data-cleaning yang sama dengan
  fit. Intercept per kategori diestimasi dari ~10–15 baris tiap kategori — kurva bisa jadi
  tidak mengalahkan median kategori, dan kalaupun menang itu bisa jadi noise.
- Median |log10(pred/actual)| menyembunyikan failure mode yang dicari judge: beberapa miss
  10–100× di ekor small-cap nyaris tidak menggerakkan median.
- **Tindak lanjut build:** laporkan JUGA mean log-error, p90, dan R² dari fit log — bukan
  hanya median. Tampilkan n per kategori di sampingnya. Tampilkan slope kurva DENGAN
  confidence interval, bukan hanya clamp [0.03, 0.80] (clamp saja terbaca sebagai "parameter
  tidak teridentifikasi").

### Poin 2 — Rantai net-value adalah tumpukan asumsi (DITERIMA SEBAGIAN, perbaiki di build)
- `implied_LOW × 5%` meng-hardcode dua pengali sekaligus — klaim "tanpa hardcode" di §4
  TIDAK AKURAT untuk bagian ini. Koreksi: 5% adalah ASUMSI yang didokumentasikan, bukan
  hasil hitung — dokumen ini sudah menuliskannya sebagai asumsi di §5.6, tapi kalimat
  "tidak ada satu pun angka yang di-hardcode" di §4 harus dihapus/dikoreksi saat build.
- Memakai p10 untuk nilai tapi point estimate untuk biaya adalah bias bearish sistematis —
  akan menghasilkan SKIP yang dibaca judge sebagai model rusak, bukan konservatisme.
- Yang HILANG dari rantai: P(airdrop terjadi), P(kamu lolos kualifikasi), dilusi / FDV
  overhang, jadwal unlock/vesting. (Kalimat terpotong di "And the F…".)
- **Tindak lanjut build:** net dihitung dari nilai EKSPEKTASIAN (implied median, bukan p10)
  dikali faktor probabilitas yang didokumentasikan (P(airdrop) × P(qualify) sebagai asumsi
  eksplisit, mis. 0.7 × 0.5 — ditulis sebagai asumsi, bukan fakta), dan band dipakai untuk
  menampilkan RENTANG net (low–high), bukan untuk menghukum satu sisi saja. Verdict tetap
  memakai net ekspektasian; band tampil sebagai ketidakpastian.

### Poin 3 — TIDAK SAMPAI (review terpotong)
- Tidak ada poin 3 yang bisa dikutip. Build session diminta tetap waspada pada lubang
  ketiga yang belum teridentifikasi — terutama soal keterbacaan dashboard (apakah semua
  bukti baru ini muat tanpa membuat board berantakan) dan soal ukuran file (top 1–5
  1,25–1,53 MB vs kita 0,90 MB — dashboard yang lebih kaya konten, bukan sekadar besar).

### Disposisi singkat
- Dua temuan di atas TIDAK membatalkan konsep v3 — keduanya adalah perbaikan spesifikasi
  (§5.4 tambah metrik; §5.6 simetriskan net; §4 koreksi klaim "tanpa hardcode").
- Aturan §7 tetap berlaku: kalau kurva kalah di tes buta (dengan metrik LENGKAP: median +
  mean + p90 + R²), build berhenti / kirim model OOS-terbaik.
