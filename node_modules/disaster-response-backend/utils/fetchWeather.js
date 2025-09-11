import axios from "axios";
import Sensor from "../models/sensorModel.js"; // your MongoDB model

const API_KEY = "YOUR_API_KEY"; // from OpenWeatherMap
const CITY = "Delhi";

export async function fetchWeatherData() {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${API_KEY}&units=metric`;
    const res = await axios.get(url);

    const data = {
      temperature: res.data.main.temp,
      humidity: res.data.main.humidity,
      windSpeed: res.data.wind.speed,
    };

    // Store into MongoDB
    await Sensor.create({
      type: "weather",
      value: data,
      timestamp: new Date(),
    });

    console.log("✅ Weather data saved:", data);
  } catch (error) {
    console.error("❌ Error fetching weather data:", error.message);
  }
}
