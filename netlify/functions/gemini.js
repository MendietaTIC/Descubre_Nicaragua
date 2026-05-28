exports.handler = async (event) => {

    try {

        const API_KEY = process.env.GEMINI_API_KEY;

        const body = JSON.parse(event.body);

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify(body)
            }
        );

        const data = await response.json();

        console.log(JSON.stringify(data));

        return {
            statusCode: 200,

            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },

            body: JSON.stringify(data)
        };

    } catch (error) {

        return {
            statusCode: 500,

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                error: error.message
            })
        };

    }

};
