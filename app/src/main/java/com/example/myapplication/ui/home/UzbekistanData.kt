package com.example.myapplication.ui.home

object UzbekistanData {

    val regions = listOf(
        "Andijon viloyati",
        "Buxoro viloyati",
        "Farg'ona viloyati",
        "Jizzax viloyati",
        "Namangan viloyati",
        "Navoiy viloyati",
        "Qashqadaryo viloyati",
        "Qoraqalpog'iston Respublikasi",
        "Samarqand viloyati",
        "Sirdaryo viloyati",
        "Surxondaryo viloyati",
        "Toshkent shahri",
        "Toshkent viloyati",
        "Xorazm viloyati"
    )

    val districtsByRegion: Map<String, List<String>> = mapOf(
        "Andijon viloyati" to listOf(
            "Andijon shahri", "Asaka", "Baliqchi", "Bo'ston", "Buloqboshi",
            "Izboskan", "Jalaquduq", "Xo'jaobod", "Marhamat", "Oltinko'l",
            "Paxtaobod", "Qo'rg'ontepa", "Shahrixon", "Ulug'nor"
        ),
        "Buxoro viloyati" to listOf(
            "Buxoro shahri", "G'ijduvon", "Jondor", "Kogon", "Qorakul",
            "Qorovulbozor", "Peshku", "Romitan", "Shafirkon", "Vobkent"
        ),
        "Farg'ona viloyati" to listOf(
            "Farg'ona shahri", "Marg'ilon shahri", "Qo'qon shahri",
            "Bag'dod", "Beshariq", "Buvayda", "Dangara", "Furqat",
            "Qo'shtepa", "Oltiariq", "Quva", "Rishton", "So'x",
            "Toshloq", "Uchko'prik", "Yozyovon"
        ),
        "Jizzax viloyati" to listOf(
            "Jizzax shahri", "Arnasoy", "Baxmal", "Do'stlik", "Forish",
            "G'allaorol", "Mirzacho'l", "Paxtakor", "Sharof Rashidov",
            "Yangiobod", "Zafarobod", "Zarbdor", "Zomin"
        ),
        "Namangan viloyati" to listOf(
            "Namangan shahri", "Chortoq", "Chust", "Kosonsoy", "Mingbuloq",
            "Namangan tumani", "Norin", "Pop", "To'raqo'rg'on", "Uychi",
            "Yangiqo'rg'on"
        ),
        "Navoiy viloyati" to listOf(
            "Navoiy shahri", "Karmana", "Konimex", "Navbahor", "Nurota",
            "Qiziltepa", "Tomdi", "Uchquduq", "Xatirchi"
        ),
        "Qashqadaryo viloyati" to listOf(
            "Qarshi shahri", "Chiroqchi", "G'uzor", "Kamashi", "Kasbi",
            "Kitob", "Ko'kdala", "Mirishkor", "Muborak", "Nishon",
            "Qamashi", "Shahrisabz", "Yakkabog'"
        ),
        "Qoraqalpog'iston Respublikasi" to listOf(
            "No'kis shahri", "Amudaryo", "Beruniy", "Bo'zatov", "Chimboy",
            "Ellikkala", "Kegeyli", "Mo'ynoq", "Qanliko'l", "Qorao'zak",
            "Qo'ng'irot", "Shumanay", "Taxtako'pir", "To'rtko'l", "Xo'jayli"
        ),
        "Samarqand viloyati" to listOf(
            "Samarqand shahri", "Bulungur", "Ishtixon", "Jomboy", "Kattaqo'rg'on",
            "Narpay", "Nurobod", "Oqdaryo", "Pastdarg'om", "Payariq",
            "Paxtachi", "Qo'shrabot", "Toyloq", "Urgut"
        ),
        "Sirdaryo viloyati" to listOf(
            "Guliston shahri", "Boyovut", "Mirzaobod", "Oqoltin", "Sardoba",
            "Sayxunobod", "Sirdaryo", "Xovos"
        ),
        "Surxondaryo viloyati" to listOf(
            "Termiz shahri", "Angor", "Bandixon", "Boysun", "Denov",
            "Jarqo'rg'on", "Kumkurgan", "Muzrabot", "Oltinsoy", "Qiziriq",
            "Sariosiyo", "Sherobod", "Sho'rchi", "Uzun"
        ),
        "Toshkent shahri" to listOf(
            "Bektemir tumani", "Chilonzor tumani", "Hamza tumani", "Mirobod tumani",
            "Mirzo Ulug'bek tumani", "Olmazor tumani", "Sergeli tumani",
            "Shayxontohur tumani", "Uchtepa tumani", "Yakkasaroy tumani",
            "Yashnobod tumani", "Yunusobod tumani"
        ),
        "Toshkent viloyati" to listOf(
            "Angren shahri", "Bekabad shahri", "Chirchiq shahri", "Olmaliq shahri",
            "Bo'stonliq", "Bo'ka", "Ohangaron", "Oqqo'rg'on", "Parkent",
            "Piskent", "Qibray", "Toshkent tumani", "Yangiyo'l",
            "Yuqorichirchiq", "Zangiota"
        ),
        "Xorazm viloyati" to listOf(
            "Urganch shahri", "Xiva shahri", "Bog'ot", "Gurlan", "Hazorasp",
            "Ko'hna Urganch", "Qo'shko'pir", "Shovot", "Tuproqqal'a",
            "Xonqa", "Yangiariq", "Yangibozor"
        )
    )
}
