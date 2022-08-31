console.log("Hello world");

// Include Fiesta.js ABOVE this file in DOM
var ori = ftc.original
var p86 = ftc.post86
var all = ori.concat(p86)

var outputOne = document.querySelector(".outputOne")
for (i=0;i<ori.length;i++)
    {
        outputOne.innerHTML += `<div class="d-flex">
                                    <div class="d-l" style="background-color: ${ori[i].hex}"></div>
                                    <div class="d-r">
                                        <p class="color">
                                            ${ori[i].color}
                                        </p>
                                        <p class="details">
                                            Produced: ${ori[i].produced} <br>
                                            SKU: ${ori[i].sku}
                                        </p>
                                    </div>
                                </div>
                                <br>`
    }
var outputTwo = document.querySelector(".outputTwo")
for (i=0;i<p86.length;i++)
    {
        outputTwo.innerHTML += `<div class="d-flex">
                                    <div class="d-l" style="background-color: ${p86[i].hex}"></div>
                                    <div class="d-r">
                                        <p class="color">
                                            ${p86[i].color}
                                        </p>
                                        <p class="details">
                                            Produced: ${p86[i].produced} <br>
                                            SKU: ${p86[i].sku}
                                        </p>
                                    </div>
                                </div>
                                <br>`
    }