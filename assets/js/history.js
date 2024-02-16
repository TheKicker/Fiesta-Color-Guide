const output = document.getElementById("history");

async function fetchAPI(){
    let url = "https://thekicker.github.io/Fiesta-Color-Guide/fiesta.json"
    // let url = "fiesta.json"
    try {
        let res = await fetch(url)
        return await res.json()
    } catch (error) {
        console.log(error)
    }
}

async function fetchHistory(){
    let data = await fetchAPI()
    data = data.history 

    for(i = 0; i < data.length; i++)
    {
        output.innerHTML += `<li><h3>${data[i].date}</h3><p>${data[i].desc}</p></li>`
    }
    console.log(data)
}

fetchHistory()
