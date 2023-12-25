function degistir() {
    var metin = document.getElementById("inputTxt").value;
    var yeniMetin = metin.replace(/“/g, '"').replace(/”/g, '"');
    document.getElementById("sonuc").value = yeniMetin;
}
function kopyala(){
    var sonuc = document.getElementById("sonuc");
    sonuc.select();

    try {
        document.execCommand("copy");
    } catch (err) {
        alert("Sonucu Kopyalarken Bir Sıkıntı Oldu")
    }
}
