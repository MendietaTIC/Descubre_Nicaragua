<script>
    // ======================= CONFIGURACIÓN API KEY (Integrada) =======================
    const API_KEY = "AIzaSyDZESzTAhwhRNgPN5pxL84nmL73zeOKxv0";  // Gemini API key proporcionada
    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    // Elementos DOM
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
    const savedListDiv = document.getElementById('saved-list');
    
    let streamVideo = null;
    let userCoords = "Ubicación no proporcionada (GPS desactivado)";
    let currentScanResult = null;          // Guarda el último escaneo exitoso para poder archivarlo
    let isProcessing = false;

    // ======================= UTILIDAD: REDIMENSIONAR IMAGEN (para evitar payload pesado) =======================
    async function resizeBase64Image(base64Str, maxWidth = 1024, maxHeight = 1024) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    const ratio = Math.min(maxWidth / width, maxHeight / height);
                    width = Math.floor(width * ratio);
                    height = Math.floor(height * ratio);
                }
                const resizeCanvas = document.createElement('canvas');
                resizeCanvas.width = width;
                resizeCanvas.height = height;
                const ctx = resizeCanvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const resized = resizeCanvas.toDataURL('image/jpeg', 0.85);
                resolve(resized.split(',')[1]);
            };
            img.onerror = () => resolve(base64Str.split(',')[1] || base64Str);
            img.src = base64Str;
        });
    }

    // ======================= CAMBIAR VISTAS (Responsive y gestión de recursos) =======================
    function switchView(viewId) {
        document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');
        
        // Actualizar pestañas activas
        if(viewId === 'view-scanner') {
            document.getElementById('tab-scanner-btn').classList.add('active');
            document.getElementById('tab-history-btn').classList.remove('active');
            startCamera();
            obtenerUbicacion();
            resetScannerUI();
        } else {
            document.getElementById('tab-history-btn').classList.add('active');
            document.getElementById('tab-scanner-btn').classList.remove('active');
            stopCamera();
            loadSavedPlaces();   // Recargar lista cada vez que se entra
        }
    }

    // ======================= GEOLOCALIZACIÓN (para contexto en prompt) =======================
    function obtenerUbicacion() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    userCoords = `Lat: ${pos.coords.latitude.toFixed(5)}, Lon: ${pos.coords.longitude.toFixed(5)}`;
                    console.log("📍 Ubicación obtenida:", userCoords);
                },
                (err) => {
                    console.warn("GPS denegado o error:", err.message);
                    userCoords = "Ubicación no disponible (permiso denegado)";
                }
            );
        } else {
            userCoords = "Geolocalización no soportada";
        }
    }

    // ======================= CÁMARA =======================
    async function startCamera() {
        if (streamVideo) stopCamera();
        try {
            const constraints = { video: { facingMode: "environment" }, audio: false };
            streamVideo = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = streamVideo;
            video.style.display = "block";
            preview.style.display = "none";
            await video.play();
        } catch (err) {
            console.error("Error cámara:", err);
            btnCapture.style.display = "none";
            labelUpload.style.display = "block";
            alert("No se pudo acceder a la cámara. Puedes subir imágenes desde tu galería.");
        }
    }

    function stopCamera() {
        if (streamVideo) {
            streamVideo.getTracks().forEach(track => track.stop());
            streamVideo = null;
            video.srcObject = null;
        }
    }

    // Reiniciar UI del escáner completamente
    function resetScannerUI() {
        video.style.display = "block";
        preview.style.display = "none";
        btnCapture.style.display = "block";
        labelUpload.style.display = "block";
        btnRetake.style.display = "none";
        btnSaveCurrent.style.display = "none";
        resultContainer.style.display = "none";
        if(fileUpload) fileUpload.value = "";
        currentScanResult = null;
        isProcessing = false;
    }

    // ======================= CAPTURA DESDE VIDEO =======================
    btnCapture.addEventListener('click', () => {
        if (isProcessing) return;
        if (!video.videoWidth || video.videoWidth === 0) {
            alert("Espera que la cámara se estabilice.");
            return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        processCapturedImage(dataUrl);
    });

    // Subida desde galería
    fileUpload.addEventListener('change', (e) => {
        if (isProcessing) return;
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            processCapturedImage(evt.target.result);
        };
        reader.readAsDataURL(file);
    });

    // ======================= PROCESAR Y ENVIAR A GEMINI =======================
    async function processCapturedImage(dataUrl) {
        if (isProcessing) return;
        isProcessing = true;
        // Detener cámara y mostrar preview
        stopCamera();
        preview.src = dataUrl;
        video.style.display = "none";
        preview.style.display = "block";
        btnCapture.style.display = "none";
        labelUpload.style.display = "none";
        btnRetake.style.display = "block";
        btnSaveCurrent.style.display = "none";
        resultContainer.style.display = "none";
        
        // Mostrar loader mientras se comprime y envía
        loader.style.display = "block";
        
        try {
            // Optimizar: reducir tamaño de imagen (base64 crudo sin metadata)
            let rawBase64 = dataUrl.split(',')[1];
            const compressedBase64 = await resizeBase64Image(dataUrl, 1024, 1024);
            // Enviar a Gemini
            await enviarAGemini(compressedBase64);
        } catch (err) {
            console.error(err);
            resultText.innerHTML = `<p><strong>⚠️ Error interno:</strong> ${err.message || "No se pudo procesar la imagen"}</p>`;
            resultContainer.style.display = "block";
        } finally {
            loader.style.display = "none";
            isProcessing = false;
        }
    }

    // Prompt experto Nicaragua + geolocalización (sin perder contexto histórico)
    async function enviarAGemini(base64Image) {
        const prompt = `Eres un historiador experto y guía turístico de Nicaragua.
        Analiza esta foto. Las coordenadas de geolocalización aproximadas del usuario son: ${userCoords}.
        Usa la imagen y (si es útil) la ubicación para identificar lagos, ríos, volcanes, monumentos o sitios emblemáticos de Nicaragua.
        Debes ser estricto: si la foto no pertenece a Nicaragua o no es reconocible, indícalo claramente.
        Responde EXCLUSIVAMENTE en formato HTML estructurado (usando <p>, <strong>, <em>, etc.) con estos puntos:
        
        - <strong>¿Es de Nicaragua?</strong>: (Sí / No / Probablemente)
        - <strong>Elemento detectado</strong>: (Nombre oficial del lugar, volcán, lago, ciudad, etc.)
        - <strong>Ubicación</strong>: (Departamento o región de Nicaragua, si aplica)
        - <strong>Historia y Descripción</strong>: (Explicación rica en historia, cultura o valor turístico, mínimo 40 palabras).
        
        Si NO pertenece a Nicaragua, explica de forma amable por qué visualmente no corresponde y da una breve nota educativa.
        IMPORTANTE: Usa solo etiquetas HTML semánticas, evita Markdown.`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                temperature: 0.4,
                topP: 0.9,
                maxOutputTokens: 800
            }
        };

        try {
            const response = await fetch(GEMINI_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorDetail = await response.text();
                throw new Error(`API respondió ${response.status}: ${errorDetail.substring(0, 120)}`);
            }

            const data = await response.json();
            if (!data.candidates || data.candidates.length === 0 || !data.candidates[0].content) {
                throw new Error("Respuesta de IA inesperada, reintenta.");
            }
            const textoRespuesta = data.candidates[0].content.parts[0].text;
            resultText.innerHTML = textoRespuesta;
            resultContainer.style.display = "block";

            // Guardar metadata del escaneo exitoso para poder guardarlo después
            currentScanResult = {
                id: Date.now(),
                fecha: new Date().toLocaleString('es-NI', { dateStyle: 'medium', timeStyle: 'short' }),
                htmlContent: textoRespuesta
            };
            btnSaveCurrent.style.display = "block";
        } catch (error) {
            console.error("Gemini error:", error);
            resultText.innerHTML = `<p><strong>❌ Error de conexión con IA:</strong> ${error.message}. Verifica tu conexión o API Key.</p>`;
            resultContainer.style.display = "block";
            btnSaveCurrent.style.display = "none";
        }
    }

    // ======================= GUARDAR EN LOCALSTORAGE =======================
    btnSaveCurrent.addEventListener('click', () => {
        if (!currentScanResult) {
            alert("No hay ningún resultado reciente para guardar.");
            return;
        }
        let saved = JSON.parse(localStorage.getItem('nicaragua_places')) || [];
        // Evitar guardado duplicado exacto (por ID)
        if (!saved.some(item => item.id === currentScanResult.id)) {
            saved.push(currentScanResult);
            localStorage.setItem('nicaragua_places', JSON.stringify(saved));
            alert("✅ ¡Guardado en tu álbum personal!");
        } else {
            alert("Este lugar ya se encuentra en tu historial.");
        }
        btnSaveCurrent.style.display = "none";
    });

    // Cargar y mostrar lista de lugares guardados
    function loadSavedPlaces() {
        if (!savedListDiv) return;
        let saved = JSON.parse(localStorage.getItem('nicaragua_places')) || [];
        if (saved.length === 0) {
            savedListDiv.innerHTML = `<div style="text-align:center; padding: 2rem; background: #fef8e7; border-radius: 2rem;"><i class="fas fa-leaf"></i> <p>Aún no has guardado ningún sitio. Escanea lugares de Nicaragua y guárdalos aquí.</p></div>`;
            return;
        }
        savedListDiv.innerHTML = "";
        // Mostrar más recientes primero
        [...saved].reverse().forEach(item => {
            const card = document.createElement('div');
            card.className = "saved-item";
            card.innerHTML = `
                <span><i class="far fa-calendar-alt"></i> ${item.fecha}</span>
                <button class="btn-delete" data-id="${item.id}"><i class="fas fa-trash-can"></i> Eliminar</button>
                <div>${item.htmlContent}</div>
            `;
            savedListDiv.appendChild(card);
        });
        // Agregar eventos a los botones de eliminar (delegación)
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                deletePlaceById(id);
            });
        });
    }

    function deletePlaceById(id) {
        let saved = JSON.parse(localStorage.getItem('nicaragua_places')) || [];
        const newList = saved.filter(item => item.id !== id);
        if (newList.length === saved.length) return;
        localStorage.setItem('nicaragua_places', JSON.stringify(newList));
        loadSavedPlaces();   // Refrescar vista
        // Si estamos en historial, refresca; en escáner da igual pero se actualiza al volver
    }

    // Borrar todo el historial
    document.getElementById('clear-all-history')?.addEventListener('click', () => {
        if (confirm("¿Borrar TODOS los lugares guardados? Esta acción es irreversible.")) {
            localStorage.removeItem('nicaragua_places');
            loadSavedPlaces();
        }
    });

    // ======================= REINICIAR (RETOMAR) =======================
    btnRetake.addEventListener('click', () => {
        resetScannerUI();
        startCamera();
        obtenerUbicacion();
        // Ocultar resultado y limpiar vista previa
        resultContainer.style.display = "none";
        currentScanResult = null;
    });

    // ======================= NAVEGACIÓN PESTAÑAS =======================
    document.getElementById('tab-scanner-btn').addEventListener('click', () => switchView('view-scanner'));
    document.getElementById('tab-history-btn').addEventListener('click', () => switchView('view-history'));

    // Inicialización al cargar
    (function init() {
        resetScannerUI();
        startCamera();
        obtenerUbicacion();
        loadSavedPlaces();
        // Si no hay permisos de cámara, igual se puede usar galería
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            btnCapture.style.display = "none";
            labelUpload.style.display = "block";
            console.warn("getUserMedia no soportada");
        }
    })();

    // Exponer global para posibles llamadas no intrusivas
    window.deletePlaceById = deletePlaceById;
</script>
