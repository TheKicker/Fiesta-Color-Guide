console.log("Hello world");

var ori = ftc.original
var nop = ftc.noProduction
var p86 = ftc.post86

var outputOne = document.querySelector(".outputOne")
for (i=0;i<ori.length;i++)
    {
        outputOne.innerHTML += `<div class="line"><span class="bubble" style="background-color: ${ori[i].hex}"></span> ${ori[i].color}</div><br>`
    }
var outputTwo = document.querySelector(".outputTwo")
for (i=0;i<p86.length;i++)
    {
        outputTwo.innerHTML += `<div class="line"><span class="bubble" style="background-color: ${p86[i].hex}"></span> ${p86[i].color}</div><br>`
    }