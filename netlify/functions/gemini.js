exports.handler = async (event) => {

    const API_KEY = process.env.GEMINI_API_KEY;

    try {

        const body = JSON.parse(event.body);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            }
        );

        const data = await response.json();

        console.log("RESPUESTA GEMINI:", JSON.stringify(data));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        };

    } catch (error) {

        console.log(error);

        return {
            statusCode: 500,
            body: JSON.stringify({
                error: error.message
            })
        };

    }

};
