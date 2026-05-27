// 1. Configuración de variables de entorno y validación inicial
const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDZESzTAhwhRNgPN5pxL84nmL73zeOKxv0";
const API_URL = `https://googleapis.com{API_KEY}`;

// 2. Elementos del DOM (Asegúrate de que estos IDs existan en tu HTML)
const btnAnalizar = document.getElementById('btnAnalizar');
const txtInput = document.getElementById('txtInput');
const txtResultado = document.getElementById('txtResultado');

// 3. Función principal para conectar con el servidor de análisis
async function conectarServidorAnalisis(textoComprobar) {
    if (!API_KEY || API_KEY.startsWith("AIzaSyDZESzTAhwhRNgPN5pxL84nmL73zeOKxv0")) {
        throw new Error("API Key no configurada. Por favor, añade una clave válida.");
    }

    const payload = {
        contents: [{
            parts: [{ text: `Analiza el siguiente texto de forma breve: ${textoComprobar}` }]
        }]
    };

    const respuesta = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!respuesta.ok) {
        const errorData = await respuesta.json().catch(() => ({}));
        console.error("Detalles del error del servidor:", errorData);
        throw new Error(`Error del servidor (Código: ${respuesta.status})`);
    }

    const datos = await respuesta.json();
    return datos.candidates[0].content.parts[0].text;
}

// 4. Manejador de eventos con captura de errores
btnAnalizar.addEventListener('click', async () => {
    const texto = txtInput.value.trim();
    
    if (!texto) {
        alert("Por favor, introduce algún texto para analizar.");
        return;
    }

    try {
        btnAnalizar.disabled = true;
        txtResultado.textContent = "Conectando con el servidor de análisis...";
        
        const resultado = await conectarServidorAnalisis(texto);
        txtResultado.textContent = resultado;
        
    } catch (error) {
        console.error("Error en la ejecución:", error);
        txtResultado.textContent = `Error: No se pudo conectar con el servidor de análisis. Verifica tu API Key y conexión. (${error.message})`;
    } finally {
        btnAnalizar.disabled = false;
    }
});
