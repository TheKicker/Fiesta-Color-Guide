console.log("Hello world");

async function fetchAPI(){
    const response = await fetch("https://thekicker.github.io/FTC-Colors/fiesta.json");
    var data = await response.json();
    showData(data)
}

function showData(data){
    var output = document.querySelector(".output")
    var col = data.colors
    for (i=0;i<col.length;i++)
    {
        output.innerHTML += `<div class="d-flex">
                                    <div class="d-l" style="background-color: ${col[i].hex}"></div>
                                    <div class="d-r">
                                        <p class="color">
                                            ${col[i].color}
                                        </p>
                                        <p class="details">
                                            Produced: ${col[i].prodStart} to ${col[i].prodEnd} <br>
                                            SKU: ${col[i].sku}
                                        </p>
                                    </div>
                                </div>
                                <br>`
    }
}
fetchAPI()
