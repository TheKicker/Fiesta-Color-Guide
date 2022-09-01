console.log("Hello world");
var shades = ["Red", "Orange", "Yellow", "Green", "Blue", "Purple", "White", "Black", "Brown"]
var shadeFilter = document.getElementById("shadeFilter")
var shadeFilterLabel = document.getElementById("shadeFilterLabel")
var yearFilter = document.getElementById("yearFilter")
var yearFilterLabel = document.getElementById("yearFilterLabel")
var output = document.getElementById("output")

async function fetchAPI(){
    let url = "https://thekicker.github.io/FTC-Colors/fiesta.json"
    try {
        let res = await fetch(url)
        return await res.json()
    } catch (error) {
        console.log(error)
    }
}

async function renderAllColors(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderRed(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "Red")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderOrange(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "Orange")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderYellow(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "Yellow")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderGreen(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "Green")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderBlue(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "Blue")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderPurple(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "Purple")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderWhite(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "White")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderBlack(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "Black")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderBrown(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == "Brown")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderCurrent(){
    var output = document.getElementById("output")
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.prodEnd == "current")
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                Produced: ${d[i].prodStart} to ${d[i].prodEnd} <br>
                                                SKU: ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}

function hideAllFields(){
    shadeFilterLabel.style.display = "none"
    shadeFilter.style.display = "none"
    yearFilterLabel.style.display = "none"
    yearFilter.style.display = "none"
    clearOutput()
}
function hideFields(inputid){
    document.getElementById(inputid).style.display = "none";
}
function showFields(inputid){
    document.getElementById(inputid).style.display = "block";
}
function userInterface(data){
    console.log(data)
}
function clearOutput(){
    output.innerHTML = ""
}

document.getElementById("filterSelection").addEventListener("change", function(){
    switch(this.value){
        case "None":
            hideAllFields()
            displayColors("All")
            break;
        case "Shade":
            hideAllFields()
            showFields("shadeFilter")
            showFields("shadeFilterLabel")
            displayColors("Shade")
            break;
        case "Year":
            hideAllFields()
            showFields("yearFilter")
            showFields("yearFilterLabel")
            displayColors("Year")
            break;
    }
})

function displayColors(f){
    if(f == "All"){
        renderAllColors()
        console.log("All rendered")
    } else if (f == "Shade"){
        renderRed()
        document.getElementById("shadeFilter").addEventListener("change", function(){
            switch(this.value){
                case "Red":
                    clearOutput()
                    renderRed()
                    console.log("Red rendered");
                    break;
                case "Orange":
                    clearOutput()
                    renderOrange()
                    console.log("Orange rendered");
                    break;
                case "Yellow":
                    clearOutput()
                    renderYellow()
                    console.log("Yellow rendered");
                    break;
                case "Green":
                    clearOutput()
                    renderGreen()
                    console.log("Green");
                    break;
                case "Blue":
                    clearOutput()
                    renderBlue()
                    console.log("Blue");
                    break;
                case "Purple":
                    clearOutput()
                    renderPurple()
                    console.log("Purple");
                    break;
                case "White":
                    clearOutput()
                    renderWhite()
                    console.log("White");
                    break;
                case "Black":
                    clearOutput()
                    renderBlack()
                    console.log("Black");
                    break;
                case "Brown":
                    clearOutput()
                    renderBrown()
                    console.log("Brown");
                    break;
            }
        })
    } else if (f == "Year"){
        console.log("Current rendered")
        clearOutput()
        renderCurrent()
    }
}

hideAllFields()
displayColors("All")
