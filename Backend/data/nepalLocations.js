const NEPAL_LOCATIONS = [
    {
        province: 'Koshi',
        districts: [
            { district: 'Bhojpur', cities: ['Bhojpur', 'Shadananda'] },
            { district: 'Dhankuta', cities: ['Dhankuta', 'Pakhribas'] },
            { district: 'Ilam', cities: ['Ilam', 'Suryodaya'] },
            { district: 'Jhapa', cities: ['Bhadrapur', 'Damak', 'Mechinagar'] },
            { district: 'Khotang', cities: ['Diktel', 'Halesi Tuwachung'] },
            { district: 'Morang', cities: ['Biratnagar', 'Belbari', 'Urlabari'] },
            { district: 'Okhaldhunga', cities: ['Siddhicharan', 'Molung'] },
            { district: 'Panchthar', cities: ['Phidim', 'Falelung'] },
            { district: 'Sankhuwasabha', cities: ['Khandbari', 'Chainpur'] },
            { district: 'Solukhumbu', cities: ['Salleri', 'Khumbu Pasanglhamu'] },
            { district: 'Sunsari', cities: ['Inaruwa', 'Itahari', 'Dharan'] },
            { district: 'Taplejung', cities: ['Phungling', 'Sidingwa'] },
            { district: 'Terhathum', cities: ['Myanglung', 'Laligurans'] },
            { district: 'Udayapur', cities: ['Gaighat', 'Katari', 'Triyuga'] }
        ]
    },
    {
        province: 'Madhesh',
        districts: [
            { district: 'Bara', cities: ['Kalaiya', 'Jitpur Simara'] },
            { district: 'Dhanusha', cities: ['Janakpur', 'Mithila'] },
            { district: 'Mahottari', cities: ['Jaleshwar', 'Bardibas'] },
            { district: 'Parsa', cities: ['Birgunj', 'Pokhariya'] },
            { district: 'Rautahat', cities: ['Gaur', 'Chandrapur'] },
            { district: 'Saptari', cities: ['Rajbiraj', 'Kanchanrup'] },
            { district: 'Sarlahi', cities: ['Malangwa', 'Haripur'] },
            { district: 'Siraha', cities: ['Siraha', 'Lahan'] }
        ]
    },
    {
        province: 'Bagmati',
        districts: [
            { district: 'Bhaktapur', cities: ['Bhaktapur', 'Madhyapur Thimi'] },
            { district: 'Chitwan', cities: ['Bharatpur', 'Ratnanagar'] },
            { district: 'Dhading', cities: ['Dhadingbesi', 'Nilkantha'] },
            { district: 'Dolakha', cities: ['Bhimeshwar', 'Jiri'] },
            { district: 'Kathmandu', cities: ['Kathmandu', 'Kirtipur', 'Tokha'] },
            { district: 'Kavrepalanchok', cities: ['Dhulikhel', 'Banepa', 'Panauti'] },
            { district: 'Lalitpur', cities: ['Lalitpur', 'Godawari'] },
            { district: 'Makwanpur', cities: ['Hetauda', 'Thaha'] },
            { district: 'Nuwakot', cities: ['Bidur', 'Belkotgadhi'] },
            { district: 'Ramechhap', cities: ['Manthali', 'Ramechhap'] },
            { district: 'Rasuwa', cities: ['Dhunche', 'Gosaikunda'] },
            { district: 'Sindhuli', cities: ['Kamalamai', 'Dudhouli'] },
            { district: 'Sindhupalchok', cities: ['Chautara', 'Melamchi'] }
        ]
    },
    {
        province: 'Gandaki',
        districts: [
            { district: 'Baglung', cities: ['Baglung', 'Galkot'] },
            { district: 'Gorkha', cities: ['Gorkha', 'Palungtar'] },
            { district: 'Kaski', cities: ['Pokhara', 'Annapurna'] },
            { district: 'Lamjung', cities: ['Besisahar', 'Madhya Nepal'] },
            { district: 'Manang', cities: ['Chame', 'Nason'] },
            { district: 'Mustang', cities: ['Jomsom', 'Gharapjhong'] },
            { district: 'Myagdi', cities: ['Beni', 'Annapurna'] },
            { district: 'Nawalpur', cities: ['Kawasoti', 'Gaindakot'] },
            { district: 'Parbat', cities: ['Kusma', 'Phalebas'] },
            { district: 'Syangja', cities: ['Putalibazar', 'Waling'] },
            { district: 'Tanahun', cities: ['Damauli', 'Bhanu'] }
        ]
    },
    {
        province: 'Lumbini',
        districts: [
            { district: 'Arghakhanchi', cities: ['Sandhikharka', 'Sitganga'] },
            { district: 'Banke', cities: ['Nepalgunj', 'Kohalpur'] },
            { district: 'Bardiya', cities: ['Gulariya', 'Rajapur'] },
            { district: 'Dang', cities: ['Ghorahi', 'Tulsipur'] },
            { district: 'Eastern Rukum', cities: ['Rukumkot', 'Bhume'] },
            { district: 'Gulmi', cities: ['Tamghas', 'Resunga'] },
            { district: 'Kapilvastu', cities: ['Taulihawa', 'Banganga'] },
            { district: 'Palpa', cities: ['Tansen', 'Rampur'] },
            { district: 'Parasi', cities: ['Ramgram', 'Sunwal'] },
            { district: 'Pyuthan', cities: ['Pyuthan', 'Sworgadwari'] },
            { district: 'Rolpa', cities: ['Liwang', 'Tribeni'] },
            { district: 'Rupandehi', cities: ['Siddharthanagar', 'Butwal', 'Tilottama'] }
        ]
    },
    {
        province: 'Karnali',
        districts: [
            { district: 'Dailekh', cities: ['Narayan', 'Dullu'] },
            { district: 'Dolpa', cities: ['Dunai', 'Thuli Bheri'] },
            { district: 'Humla', cities: ['Simikot', 'Namkha'] },
            { district: 'Jajarkot', cities: ['Khalanga', 'Bheri'] },
            { district: 'Jumla', cities: ['Chandannath', 'Tatopani'] },
            { district: 'Kalikot', cities: ['Manma', 'Tilagufa'] },
            { district: 'Mugu', cities: ['Gamgadhi', 'Chhayanath Rara'] },
            { district: 'Rukum West', cities: ['Musikot', 'Aathbiskot'] },
            { district: 'Salyan', cities: ['Salyan Khalanga', 'Sharada'] },
            { district: 'Surkhet', cities: ['Birendranagar', 'Bheriganga'] }
        ]
    },
    {
        province: 'Sudurpashchim',
        districts: [
            { district: 'Achham', cities: ['Mangalsen', 'Sanfebagar'] },
            { district: 'Baitadi', cities: ['Dasharathchand', 'Patan'] },
            { district: 'Bajhang', cities: ['Chainpur', 'Jayaprithvi'] },
            { district: 'Bajura', cities: ['Martadi', 'Budhinanda'] },
            { district: 'Dadeldhura', cities: ['Dadeldhura', 'Amargadhi'] },
            { district: 'Darchula', cities: ['Darchula', 'Shailyashikhar'] },
            { district: 'Doti', cities: ['Dipayal', 'Shikhar'] },
            { district: 'Kailali', cities: ['Dhangadhi', 'Tikapur', 'Lamki Chuha'] },
            { district: 'Kanchanpur', cities: ['Bhimdatta', 'Krishnapur'] }
        ]
    }
];

module.exports = { NEPAL_LOCATIONS };
