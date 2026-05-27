// CONFIGURACIÓN DE TU API DE GEMINI (Utiliza tu clave aquí)
const API_KEY = "AIzaSyDZESzTAhwhRNgPN5pxL84nmL73zeOKxv0"; 

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

// Alternar vistas sin recargar
function switchView(viewId) {
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    
    if(viewId === 'view-scanner') {
        startCamera();
        obtenerUbicacion();
        resetScannerUI();
    } else {
        stopCamera();
    }
}

// Controladores de la cámara
async function startCamera() {
    try {
        streamVideo = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: "environment" },
            audio: false 
        });
        video.srcObject = streamVideo;
        video.style.display = "block";
        preview.style.display = "none";
    } catch (err) {
        console.warn("Cámara no disponible o denegada. Se usará modo galería.");
        btnCapture.style.display = "none";
    }
}

function stopCamera() {
    if(streamVideo) {
        streamVideo.getTracks().forEach(track => track.stop());
    }
}

// Conseguir GPS del usuario
function obtenerUbicacion() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => { userCoords = `Lat: ${pos.coords.latitude}, Lon: ${pos.coords.longitude}`; },
            () => { console.log("Permiso de GPS denegado."); }
        );
    }
}

// Capturar desde el feed de video
btnCapture.addEventListener('click', () => {
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const base64Data = canvas.toDataURL('image/jpeg');
    processCapturedImage(base64Data);
});

// Cargar desde la galería
fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        processCapturedImage(event.target.result);
    };
    reader.readAsDataURL(file);
});

function processCapturedImage(dataUrl) {
    stopCamera();
    preview.src = dataUrl;
    video.style.display = "none";
    preview.style.display = "block";
    
    btnCapture.style.display = "none";
    labelUpload.style.display = "none";
    btnRetake.style.display = "block";
    
    const base64Clean = dataUrl.split(',')[1]; // Limpiar el encabezado data:image/jpeg;base64,
    enviarAGemini(base64Clean);
}

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

btnRetake.addEventListener('click', () => {
    resetScannerUI();
    startCamera();
});

// Conexión a Gemini Vision API (CORREGIDO PARA IMÁGENES)
async function enviarAGemini(base64Image) {
    loader.style.display = "block";
    resultContainer.style.display = "none";

    const prompt = `Eres un historiador experto y guía turístico de Nicaragua.
    Analiza esta foto sabiendo que las coordenadas de geolocalización aproximadas son: ${userCoords}.
    Cruza la información visual con el GPS de forma estricta para determinar con precisión lagos, ríos, volcanes o monumentos nicaragüenses específicos.

    Responde en formato HTML estructurado (usa etiquetas <p>, <strong>, etc.) con los siguientes puntos fijos:
    - <strong>¿Es de Nicaragua?</strong>: (Sí o No)
    - <strong>Elemento detectado</strong>: (Nombre oficial)
    - <strong>Ubicación</strong>: (Departamento o región de Nicaragua)
    - <strong>Historia y Descripción</strong>: (Explicación rica sobre su contexto histórico o valor turístico nicaragüense).

    Si NO pertenece a Nicaragua, acláralo amablemente y explica el motivo físico o geográfico detectado.`;

    // ENDPOINT CORREGIDO: gemini-1.5-flash es el modelo multimodal gratuito
    const url = `https://googleapis.com{API_KEY}`;

    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/jpeg", data: base64Image } }
                    ]
                }]
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const textoRespuesta = data.candidates[0].content.parts[0].text;
        
        resultText.innerHTML = textoRespuesta;
        resultContainer.style.display = "block";
        
        currentScanResult = {
            id: Date.now(),
            fecha: new Date().toLocaleDateString('es-NI'),
            htmlContent: textoRespuesta
        };
        btnSaveCurrent.style.display = "block";

    } catch (error) {
        console.error(error);
        resultText.innerHTML = `<p><strong>Error:</strong> No se pudo conectar con el servidor de análisis o procesar la imagen de forma correcta. (${error.message})</p>`;
        resultContainer.style.display = "block";
    } finally {
        loader.style.display = "none";
    }
}

// LocalStorage (Guardado temporal)
btnSaveCurrent.addEventListener('click', () => {
    if(!currentScanResult) return;
    let saved = JSON.parse(localStorage.getItem('nicaragua_places')) || [];
    saved.push(currentScanResult);
    localStorage.setItem('nicaragua_places', JSON.stringify(saved));
    alert("¡Guardado exitosamente en tu álbum!");
    btnSaveCurrent.style.display = "none";
});

function loadSavedPlaces() {
    const listContainer = document.getElementById('saved-list');
    let saved = JSON.parse(localStorage.getItem('nicaragua_places')) || [];
    
    if(saved.length === 0) {
        listContainer.innerHTML = "<p style='text-align:center; color:#718096; margin-top:20px;'>No tienes lugares guardados todavía.</p>";
        return;
    }
    
    listContainer.innerHTML = "";
    saved.reverse().forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = "saved-item";
        itemDiv.innerHTML = `
            <span><i class="fa-solid fa-calendar-days"></i> Escaneado el: ${item.fecha}</span>
            <div>${item.htmlContent}</div>
            <button class="btn-delete" onclick="deletePlace(${item.id})"><i class="fa-solid fa-trash-can"></i></button>
        `;
        listContainer.appendChild(itemDiv);
    });
}

function deletePlace(id) {
    let saved = JSON.parse(localStorage.getItem('nicaragua_places')) || [];
    saved = saved.filter(item => item.id !== id);
    localStorage.setItem('nicaragua_places', JSON.stringify(saved));
    loadSavedPlaces();
}
