// ===============================
// APP.JS REPARADO PARA NETLIFY
// ===============================

// Elementos de la interfaz
const video = document.getElementById('camera-feed');
const preview = document.getElementById('photo-preview');
const canvas = document.getElementById('capture-canvas');
const fileUpload = document.getElementById('file-upload');

const btnCapture = document.getElementById('btn-capture');
const labelUpload = document.getElementById('label-upload');
const btnRetake = document.getElementById('btn-retake');
const btnSaveCurrent = document.getElementById('btn-save-current');

const loader = document.getElementById('loader');
const resultContainer = document.getElementById('resultado-container');
const resultText = document.getElementById('resultado-texto');

let streamVideo = null;
let userCoords = "Ubicación no proporcionada";
let currentScanResult = null;


// ===============================
// CAMBIAR VISTAS
// ===============================

function switchView(viewId) {

    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    const targetView = document.getElementById(viewId);

    if (targetView) {
        targetView.classList.add('active');
    }

    if (viewId === 'view-scanner') {

        startCamera();
        obtenerUbicacion();
        resetScannerUI();

    } else {

        stopCamera();

    }

}


// ===============================
// INICIAR CÁMARA
// ===============================

async function startCamera() {

    try {

        streamVideo = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment"
            },
            audio: false
        });

        video.srcObject = streamVideo;

        video.style.display = "block";
        preview.style.display = "none";

    } catch (err) {

        console.warn("Cámara no disponible.");

        btnCapture.style.display = "none";

    }

}


// ===============================
// DETENER CÁMARA
// ===============================

function stopCamera() {

    if (streamVideo) {

        streamVideo.getTracks().forEach(track => track.stop());

    }

}


// ===============================
// OBTENER GPS
// ===============================

function obtenerUbicacion() {

    if (navigator.geolocation) {

        navigator.geolocation.getCurrentPosition(

            (pos) => {

                userCoords =
                    `Lat: ${pos.coords.latitude}, Lon: ${pos.coords.longitude}`;

            },

            () => {

                console.log("GPS denegado.");

            }

        );

    }

}


// ===============================
// CAPTURAR FOTO
// ===============================

btnCapture.addEventListener('click', () => {

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Data = canvas.toDataURL('image/jpeg');

    processCapturedImage(base64Data);

});


// ===============================
// SUBIR IMAGEN
// ===============================

fileUpload.addEventListener('change', (e) => {

    const file = e.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(event) {

        processCapturedImage(event.target.result);

    };

    reader.readAsDataURL(file);

});


// ===============================
// PROCESAR IMAGEN
// ===============================

function processCapturedImage(dataUrl) {

    stopCamera();

    preview.src = dataUrl;

    video.style.display = "none";
    preview.style.display = "block";

    btnCapture.style.display = "none";
    labelUpload.style.display = "none";

    btnRetake.style.display = "block";

    const base64Clean = dataUrl.split(',')[1];

    enviarAGemini(base64Clean);

}


// ===============================
// RESET UI
// ===============================

function resetScannerUI() {

    video.style.display = "block";

    preview.style.display = "none";

    btnCapture.style.display = "block";
    labelUpload.style.display = "block";

    btnRetake.style.display = "none";
    btnSaveCurrent.style.display = "none";

    resultContainer.style.display = "none";

    fileUpload.value = "";

}


// ===============================
// RETOMAR FOTO
// ===============================

btnRetake.addEventListener('click', () => {

    resetScannerUI();

    startCamera();

});


// ===============================
// ENVIAR A GEMINI
// ===============================

async function enviarAGemini(base64Image) {

    loader.style.display = "block";

    resultContainer.style.display = "none";

    const prompt = `
    Eres un historiador experto y guía turístico de Nicaragua.

    Analiza esta foto sabiendo que las coordenadas aproximadas son:
    ${userCoords}

    Detecta:
    volcanes,
    lagos,
    monumentos,
    ciudades,
    paisajes turísticos,
    iglesias,
    sitios históricos de Nicaragua.

    Responde en HTML usando:
    <p>
    <strong>
    <br>

    Incluye:

    - ¿Es de Nicaragua?
    - Lugar detectado
    - Departamento
    - Historia
    - Descripción turística

    Si no es de Nicaragua explícalo.
    `;

    try {

        const response = await fetch("/.netlify/functions/gemini", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                contents: [

                    {

                        parts: [

                            {
                                text: prompt
                            },

                            {
                                inlineData: {
                                    mimeType: "image/jpeg",
                                    data: base64Image
                                }
                            }

                        ]

                    }

                ]

            })

        });

        const data = await response.json();

        console.log(data);

        if (
            data.candidates &&
            data.candidates.length > 0 &&
            data.candidates[0].content &&
            data.candidates[0].content.parts
        ) {

            const textoRespuesta =
                data.candidates[0].content.parts[0].text;

            resultText.innerHTML = textoRespuesta;

            resultContainer.style.display = "block";

            currentScanResult = {

                id: Date.now(),

                fecha: new Date().toLocaleDateString('es-NI'),

                htmlContent: textoRespuesta

            };

            btnSaveCurrent.style.display = "block";

        } else {

            resultText.innerHTML = `
                <p>
                    <strong>Error:</strong>
                    Gemini no devolvió una respuesta válida.
                </p>
            `;

            resultContainer.style.display = "block";

        }

    } catch (error) {

        console.error(error);

        resultText.innerHTML = `
            <p>
                <strong>Error:</strong>
                ${error.message}
            </p>
        `;

        resultContainer.style.display = "block";

    } finally {

        loader.style.display = "none";

    }

}


// ===============================
// GUARDAR RESULTADOS
// ===============================

btnSaveCurrent.addEventListener('click', () => {

    if (!currentScanResult) return;

    let saved =
        JSON.parse(localStorage.getItem('nicaragua_places')) || [];

    saved.push(currentScanResult);

    localStorage.setItem(
        'nicaragua_places',
        JSON.stringify(saved)
    );

    alert("¡Guardado exitosamente!");

    btnSaveCurrent.style.display = "none";

});


// ===============================
// CARGAR GUARDADOS
// ===============================

function loadSavedPlaces() {

    const listContainer =
        document.getElementById('saved-list');

    let saved =
        JSON.parse(localStorage.getItem('nicaragua_places')) || [];

    if (saved.length === 0) {

        listContainer.innerHTML = `
            <p style="text-align:center;color:#718096;margin-top:20px;">
                No tienes lugares guardados todavía.
            </p>
        `;

        return;

    }

    listContainer.innerHTML = "";

    saved.reverse().forEach(item => {

        const itemDiv = document.createElement('div');

        itemDiv.className = "saved-item";

        itemDiv.innerHTML = `
            <span>
                Escaneado el: ${item.fecha}
            </span>

            <div>
                ${item.htmlContent}
            </div>

            <button
                class="btn-delete"
                onclick="deletePlace(${item.id})"
            >
                Eliminar
            </button>
        `;

        listContainer.appendChild(itemDiv);

    });

}


// ===============================
// ELIMINAR
// ===============================

function deletePlace(id) {

    let saved =
        JSON.parse(localStorage.getItem('nicaragua_places')) || [];

    saved = saved.filter(item => item.id !== id);

    localStorage.setItem(
        'nicaragua_places',
        JSON.stringify(saved)
    );

    loadSavedPlaces();

}


// ===============================
// INICIAR APP
// ===============================

window.addEventListener('load', () => {

    if (document.getElementById('view-scanner')) {

        switchView('view-scanner');

    }

});
