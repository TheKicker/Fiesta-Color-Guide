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
                                                <strong>Produced:</strong> ${d[i].produced} <br>
                                                <strong>SKU:</strong> ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function render(c){
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.shadeOf == c)
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                <strong>Produced:</strong> ${d[i].produced} <br>
                                                <strong>SKU:</strong> ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderCurrent(){
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
                                                <strong>Produced:</strong> ${d[i].produced} <br>
                                                <strong>SKU:</strong> ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderOriginal(){
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.prodEnd < 1973)
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                <strong>Produced:</strong> ${d[i].produced} <br>
                                                <strong>SKU:</strong> ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
async function renderPost86(){
    let data = await fetchAPI()
    let d = data.colors.filter(color=>color.prodStart >= 1986)
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                <strong>Produced:</strong> ${d[i].produced} <br>
                                                <strong>SKU:</strong> ${d[i].sku}
                                            </p>
                                        </div>
                                    </div>
                                <br>`
        }
    }
}
function createDec(decade) {
    var a = decade;
    var b = a + 9;
    var arr = [...Array(b - a + 1).keys()].map((x) => x + a);
    console.log(`createDec: ${arr}`)
    return arr
}
function createArr(a, b) {
    console.log(`A: ${a} // B: ${b}`)
    var arr = [...Array(b - a + 1).keys()].map((x) => x + a);
    console.log(`createArr: ${arr}`)
    return arr
}
function check(decade, prodStar, prodEnd){
    var decadeArr = createDec(decade)
    var producArr = createArr(prodStar, prodEnd)
    // Need logic to check if color was produced in decade 
    console.log(decadeArr, producArr)
}

async function renderYear(decade){
    let baseYear = decade // 1940 for example
    let endYear = baseYear + 9 // 1949 for example
    let data = await fetchAPI()
    // Need to figure out formula, right now "current" breaks it toward modern colors
    let d = data.colors.filter(color=>color.prodStart <= endYear && color.prodEnd >= baseYear)
    for (i=0;i<d.length;i++){
        {
            output.innerHTML += `<div class="d-flex">
                                        <div class="d-l" style="background-color: ${d[i].hex}"></div>
                                        <div class="d-r">
                                            <p class="color">
                                                ${d[i].color}
                                            </p>
                                            <p class="details">
                                                <strong>Produced:</strong> ${d[i].produced} <br>
                                                <strong>SKU:</strong> ${d[i].sku}
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
    } else if (f == "Shade"){
        render("Red")
        document.getElementById("shadeFilter").addEventListener("change", function(){
            switch(this.value){
                case "Red":
                    clearOutput()
                    render("Red")
                    console.log("Red rendered");
                    break;
                case "Orange":
                    clearOutput()
                    render("Orange")
                    console.log("Orange rendered");
                    break;
                case "Yellow":
                    clearOutput()
                    renderYellow()
                    console.log("Yellow rendered");
                    break;
                case "Green":
                    clearOutput()
                    render("Green")
                    console.log("Green");
                    break;
                case "Blue":
                    clearOutput()
                    render("Blue")
                    console.log("Blue");
                    break;
                case "Purple":
                    clearOutput()
                    render("Purple")
                    console.log("Purple");
                    break;
                case "White":
                    clearOutput()
                    render("White")
                    console.log("White");
                    break;
                case "Black":
                    clearOutput()
                    render("Black")
                    console.log("Black");
                    break;
                case "Brown":
                    clearOutput()
                    render("Brown")
                    console.log("Brown");
                    break;
            }
        })
    } else if (f == "Year"){
        renderCurrent()
        document.getElementById("yearFilter").addEventListener("change", function(){
            switch(this.value){
                case "Current":
                    clearOutput()
                    renderCurrent()
                    break;
                case "Original":
                    clearOutput()
                    renderOriginal()
                    break;
                case "Post86":
                    clearOutput()
                    renderPost86()
                    break;
                case "1930":
                    clearOutput()
                    renderYear(1930)
                    break;
                case "1940":
                    clearOutput()
                    renderYear(1940)
                    break;
                case "1950":
                    clearOutput()
                    renderYear(1950)
                    break;
                case "1960":
                    clearOutput()
                    renderYear(1960)
                    break;
                case "1970":
                    clearOutput()
                    renderYear(1970)
                    break;
                case "1980":
                    clearOutput()
                    renderYear(1980)
                    break;
                case "1990":
                    clearOutput()
                    renderYear(1990)
                    break;
                case "2000":
                    clearOutput()
                    renderYear(2000)
                    break;
                case "2010":
                    clearOutput()
                    renderYear(2010)
                    break;
                case "2020":
                    clearOutput()
                    renderYear(2020)
                    break;
            }
        })
    }
}

hideAllFields()
displayColors("All")
