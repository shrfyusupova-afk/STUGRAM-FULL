const http = require("http");

// Render'ning bepul Web Service tarifi HTTP so'rov kelmasa ~15 daqiqadan
// keyin xizmatni "uxlatib qo'yadi". Telegram uzoq so'rov (long polling)
// orqali ishlaydi, ya'ni tashqi HTTP trafik bo'lmaydi -- shu sababli
// tashqi pinger (UptimeRobot / cron-job.org) mana shu endpointga vaqti-vaqti
// bilan so'rov yuborib, xizmatni uyg'oq saqlaydi.
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Qora bot ishlab turibdi ✅");
});

server.listen(PORT, () => {
  console.log(`Health-check server ${PORT}-portda ishga tushdi.`);
});

module.exports = server;
