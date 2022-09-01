console.log("Hello world");

// Include Fiesta.js ABOVE this file in DOM
var col = ftc.original

var output = document.querySelector(".output")
for (i=0;i<col.length;i++)
    {
        output.innerHTML += `<div class="d-flex">
                                    <div class="d-l" style="background-color: ${col[i].hex}"></div>
                                    <div class="d-r">
                                        <p class="color">
                                            ${col[i].color}
                                        </p>
                                        <p class="details">
                                            Produced: ${col[i].produced} <br>
                                            SKU: ${col[i].sku}
                                        </p>
                                    </div>
                                </div>
                                <br>`
    }