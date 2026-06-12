
# ==========================================
# COMPREHENSIVE TRUSTED DOMAIN DATABASE
# ==========================================
# This list is used for:
# 1. Whitelisting (Safe status)
# 2. Brand Extraction for Typosquatting Detection
# 3. Impersonation Analysis

TRUSTED_DOMAINS = {
    # --- GLOBAL GIANTS (TECH, SOCIAL, CLOUD) ---
    "google.com", "google.co.uk", "google.de", "google.com.tr",
    "youtube.com", "youtu.be", "ytimg.com",
    "facebook.com", "fb.com", "messenger.com",
    "instagram.com", "cdninstagram.com",
    "twitter.com", "x.com", "t.co",
    "linkedin.com", "licdn.com",
    "whatsapp.com", "whatsapp.net",
    "tiktok.com", "douyin.com",
    "microsoft.com", "live.com", "office.com", "office365.com", "azure.com", "outlook.com", "bing.com", "msn.com", "skype.com", "github.com",
    "apple.com", "icloud.com", "itunes.com", "cdn-apple.com",
    "amazon.com", "amazon.co.uk", "amazon.de", "ssl-images-amazon.com", "aws.amazon.com",
    "netflix.com", "nflxvideo.net",
    "spotify.com", "scdn.co",
    "twitch.tv", "discord.com", "discord.gg", "discordapp.com",
    "zoom.us", "dropbox.com", "wetransfer.com", "slack.com", "trello.com", "atlassian.com", "notion.so",
    "adobe.com", "behance.net", "figma.com", "canva.com",
    "gitlab.com", "bitbucket.org", "stackoverflow.com", "npm.im", "npmjs.com",
    "wikipedia.org", "wikimedia.org", "wiktionary.org", "archive.org",
    "openai.com", "chatgpt.com", "anthropic.com", "claude.ai", "midjourney.com",
    "reddit.com", "quora.com", "medium.com", "tumblr.com", "pinterest.com",
    "yahoo.com", "duckduckgo.com", "yandex.com", "yandex.com.tr", "yandex.ru",
    "cloudflare.com", "speedtest.net",
    "imdb.com", "fandom.com", "roblox.com", "steamcommunity.com", "steampowered.com", "epicgames.com", "playstation.com", "xbox.com",

    # --- GLOBAL E-COMMERCE & TRAVEL & FINANCE ---
    "aliexpress.com", "alibaba.com", "ebay.com", "etsy.com", "temu.com", "shein.com",
    "booking.com", "airbnb.com", "tripadvisor.com", "expedia.com", "skyscanner.net", "agoda.com",
    "paypal.com", "stripe.com", "wise.com", "westernunion.com", "revolut.com", "coinbase.com", "binance.com",

    # ==========================================
    # TURKEY SPECIFIC DOMAINS
    # ==========================================

    # --- TR GOVERNMENT (E-DEVLET & OFFICIAL) ---
    "turkiye.gov.tr", "edevlet.gov.tr", "tccb.gov.tr",
    "gib.gov.tr", "ivd.gib.gov.tr", "intvrg.gib.gov.tr", # Tax
    "nvi.gov.tr", "randevu.nvi.gov.tr", # Population / ID
    "sgk.gov.tr", "gss.sgk.gov.tr", # Social Security
    "egm.gov.tr", "pa.edu.tr", # Police
    "adalet.gov.tr", "uyap.gov.tr", "vatandas.uyap.gov.tr", # Justice
    "meb.gov.tr", "eba.gov.tr", "osym.gov.tr", "ais.osym.gov.tr", "yok.gov.tr", # Education
    "saglik.gov.tr", "mhrs.gov.tr", "enabiz.gov.tr", "hssgm.gov.tr", # Health
    "icisleri.gov.tr", "disisleri.gov.tr", "konsolosluk.gov.tr",
    "resmigazete.gov.tr", "mevzuat.gov.tr",
    "hmb.gov.tr", "tcmb.gov.tr", "bddk.org.tr", "spk.gov.tr", # Finance / Banking Reg
    "ptt.gov.tr", "pttavm.com", "turkiye.gov.tr",
    "cimer.gov.tr", "iskur.gov.tr", "kgm.gov.tr", "hgs.pttavm.com",

    # --- TR BANKING & FINANCE ---
    "ziraatbank.com.tr", "ziraatbankasi.com.tr", "ziraatkatilim.com.tr",
    "isbank.com.tr", "isbankasi.com.tr",
    "garantibbva.com.tr", "garanti.com.tr", "bonus.com.tr",
    "akbank.com", "akbank.com.tr", "axess.com.tr",
    "yapikredi.com.tr", "worldcard.com.tr",
    "vakifbank.com.tr", "vakifkatilim.com.tr",
    "halkbank.com.tr", "halkbankasi.com.tr",
    "qnbfinansbank.com", "qnb.com.tr", "enpara.com",
    "denizbank.com", "denizbank.com.tr",
    "teb.com.tr", "cepteteb.com.tr",
    "ing.com.tr",
    "kuveytturk.com.tr",
    "albaraka.com.tr",
    "turkiyefinans.com.tr",
    "odeabank.com.tr",
    "burgan.com.tr",
    "fibabanka.com.tr",
    "sekerbank.com.tr",
    "anadolubank.com.tr",
    "aktifbank.com.tr",
    # Fintech / Payment
    "papara.com", "tosla.com", "ininal.com", "paycell.com.tr", 
    "pep.com.tr", "param.com.tr", "fups.com", "sipay.com.tr", "iyzico.com",
    "findex.com", "bkm.com.tr", "troyodeme.com",

    # --- TR E-COMMERCE & MARKETPLACE ---
    "trendyol.com", "ty.gl", "dolap.com",
    "hepsiburada.com", "hb.com",
    "n11.com",
    "amazon.com.tr",
    "sahibinden.com",
    "yemeksepeti.com",
    "getir.com",
    "ciceksepeti.com", "bonnyfood.com.tr",
    "letgo.com", "otoplus.com",
    "arabam.com",
    "gardrops.com",
    "shopier.com",
    "armut.com",

    # --- TR RETAIL & BRANDS ---
    "migros.com.tr", "sanalmarket.com.tr", "macrocenter.com.tr",
    "carrefoursa.com",
    "sokmarket.com.tr",
    "a101.com.tr",
    "bim.com.tr",
    "teknosa.com",
    "mediamarkt.com.tr",
    "vatanbilgisayar.com",
    "lcwaikiki.com", "defacto.com.tr", "mavicompany.com", "mavi.com", "koton.com",
    "boyner.com.tr", "beymen.com", "morhipo.com", "network.com.tr",
    "koctas.com.tr", "ikea.com.tr",
    "vestel.com.tr", "arcelik.com.tr", "beko.com.tr",
    "gratis.com", "watsons.com.tr", "rossmann.com.tr", "eve.com.tr",

    # --- TR NEWS & MEDIA ---
    "hurriyet.com.tr",
    "milliyet.com.tr",
    "sozcu.com.tr",
    "sabah.com.tr",
    "haberturk.com",
    "ntv.com.tr", "ntvspor.net",
    "cnnturk.com",
    "trthaber.com", "trt.net.tr", "trtizle.com", "tabii.com",
    "mynet.com",
    "haberler.com",
    "sondakika.com",
    "onedio.com",
    "eksisozluk.com", # Keeping main one, though they change often
    "donanimhaber.com", "technopat.net", "webtekno.com", "shiftdelete.net", "chip.com.tr",
    "kizlarsoruyor.com",
    "blutv.com", "exxen.com", "puhutv.com", "gain.tv",

    # --- TR TELECOM & UTILITIES ---
    "turkcell.com.tr", "superonline.net", "fizy.com", "bip.com",
    "vodafone.com.tr",
    "turktelekom.com.tr", "ttnet.com.tr", "tivibu.com.tr",
    "turksat.com.tr", "kablonet.com.tr",
    "igdas.istanbul", "bedas.com.tr", "ayedas.com.tr", "iski.istanbul", "aski.gov.tr", "izsu.gov.tr",
    "enerjisa.com.tr", "ckbogazici.com.tr",

    # --- TR TRANSPORT & TRAVEL ---
    "thy.com", "turkishairlines.com", "anadolujet.com",
    "pegasus.com", "flypgs.com",
    "sunexpress.com",
    "tcdd.gov.tr", "ebilet.tcddtasimacilik.gov.tr",
    "obilet.com",
    "enuygun.com", "turna.com",
    "etstur.com", "jollytur.com", "tatilbudur.com", "setur.com.tr",
    "marti.tech", "binbin.tech", "bitaksi.com", "uber.com",

    # --- TR EDUCATION ---
    "anadolu.edu.tr", "aof.anadolu.edu.tr",
    "istanbul.edu.tr", "itu.edu.tr", "odtu.edu.tr", "boun.edu.tr", "yildiz.edu.tr", "hacettepe.edu.tr",
    "bilkent.edu.tr", "koc.edu.tr", "sabanci.edu.tr",
    "udemy.com", "coursera.org",

    # --- TR LEGAL BETTING (WHITELISTED) ---
    "iddaa.com",
    "nesine.com",
    "misli.com",
    "bilyoner.com",
    "tuttur.com",
    "birebin.com",
    "tjk.org"
}

# Explicitly Risky Keywords
RISKY_KEYWORDS = [
    "casino", "bet", "bahis", "slot", "poker", "rulet", "roulette", 
    "kumar", "jackpot", "bonus", "deneme", "freespin", "win", "kazan",
    "illegal", "kacak", "sweetbonanza", "gatesofolympus", "aviator"
]
