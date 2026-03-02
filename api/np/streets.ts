import axios from "axios";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const NP_API_URL = "https://api.novaposhta.ua/v2.0/json/";
  const NP_API_KEY = process.env.NOVA_POSHTA_API_KEY;

  try {
    const { cityRef, search } = req.body;
    const response = await axios.post(NP_API_URL, {
      apiKey: NP_API_KEY,
      modelName: "Address",
      calledMethod: "getStreet",
      methodProperties: {
        CityRef: cityRef,
        FindByString: search,
        Limit: "20",
      },
    });
    res.status(200).json(response.data);
  } catch (error) {
    console.error("NP Streets Error:", error);
    res.status(500).json({ error: "Failed to fetch streets" });
  }
}
