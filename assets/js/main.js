console.log("Hello world");

var ori = ftc.original
var p86 = ftc.post86

var outputOne = document.querySelector(".outputOne")
for (i=0;i<ori.length;i++)
    {
        outputOne.innerHTML += `<div class="card">
                                    <div class="top">
                                        <span><span class="bubble" style="background-color:${ori[i].hex}"></span> ${ori[i].color}</span>
                                    </div>
                                    <div class="mid">
                                        Produced: ${ori[i].produced}<br>
                                        SKU: ${ori[i].sku}
                                    </div>
                                </div>
                                <br>`
    }
var outputTwo = document.querySelector(".outputTwo")
for (i=0;i<p86.length;i++)
    {
        outputTwo.innerHTML += `<div class="card">
                                    <div class="top">
                                        <span><span class="bubble" style="background-color:${p86[i].hex}"></span> ${p86[i].color}</span>
                                    </div>
                                    <div class="mid">
                                        Produced: ${p86[i].produced}<br>
                                        SKU: ${p86[i].sku}
                                    </div>
                                </div>
                                <br>`
    }