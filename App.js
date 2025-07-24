import React, { useState, useEffect } from "react";
import axios from "axios";

const YOUTUBE_API_KEY = ProcessingInstruction.env.REACT_APP_YOUTUBE_API_KEY;

function App() {
  const [input, setInput] = useState("");
  const [items, setItems] = useState(() => {
    const saved = localStorage.getItem("channels");
    return saved ? JSON.parse(saved) : [];
  });

  // Kanal ID veya video ID çıkartma fonksiyonu
  const extractIds = async (urlOrId) => {
    try {
      // Eğer video linkiyse video ID al
      const videoMatch = urlOrId.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
      );
      if (videoMatch) {
        return { type: "video", id: videoMatch[1] };
      }

      // Eğer @kullanıcı adı varsa kanal ID'yi bul
      if (urlOrId.includes("@")) {
        const username = urlOrId.replace("@", "");
        const res = await axios.get(
          `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${username}&key=${YOUTUBE_API_KEY}`
        );
        if (res.data.items.length > 0) {
          return { type: "channel", id: res.data.items[0].id };
        }
      }

      // Kanal linki (/channel/ veya /c/ veya /user/)
      const channelMatch = urlOrId.match(/youtube\.com\/channel\/([a-zA-Z0-9_-]+)/);
      if (channelMatch) {
        return { type: "channel", id: channelMatch[1] };
      }
      const customMatch = urlOrId.match(/youtube\.com\/(c|user)\/([a-zA-Z0-9_-]+)/);
      if (customMatch) {
        const name = customMatch[2];
        const res = await axios.get(
          `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${name}&key=${YOUTUBE_API_KEY}`
        );
        if (res.data.items.length > 0) {
          return { type: "channel", id: res.data.items[0].id };
        }
      }

      // Direkt kanal ID yazıldıysa da kabul et
      if (/^[a-zA-Z0-9_-]{24}$/.test(urlOrId)) {
        return { type: "channel", id: urlOrId };
      }

      return null;
    } catch (e) {
      console.error("ID çıkarma hatası", e);
      return null;
    }
  };

  // Canlı yayını bul
  const fetchLiveVideoId = async (idObj) => {
    try {
      if (idObj.type === "video") {
        // Video linki verilmiş, bunu direk kullan
        return idObj.id;
      }
      if (idObj.type === "channel") {
        // Kanalın canlı yayını varsa bul
        const res = await axios.get(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${idObj.id}&eventType=live&type=video&key=${YOUTUBE_API_KEY}`
        );
        if (res.data.items.length > 0) {
          return res.data.items[0].id.videoId;
        }
      }
      return null;
    } catch (e) {
      console.error("Canlı yayın çekme hatası", e);
      return null;
    }
  };

  // Videoları güncelle
  const updateVideos = async () => {
    const newItems = [];
    for (let input of items) {
      const idObj = await extractIds(input.input);
      if (idObj) {
        const videoId = await fetchLiveVideoId(idObj);
        newItems.push({
          ...input,
          videoId,
          error: videoId ? null : "Canlı yayın bulunamadı",
        });
      } else {
        newItems.push({ ...input, videoId: null, error: "Geçersiz link veya kanal" });
      }
    }
    setItems(newItems);
  };

  // Başlangıçta veya items değişince canlı yayınları güncelle
  useEffect(() => {
    if (items.length > 0) {
      updateVideos();
    }
  }, []);

  // Yeni kanal/video ekle
  const handleAdd = async () => {
    if (!input.trim()) return alert("Lütfen kanal, kullanıcı adı veya video linki girin.");
    // Aynı input eklenmiş mi kontrol
    if (items.some((i) => i.input === input.trim())) {
      alert("Bu zaten eklendi.");
      setInput("");
      return;
    }
    const idObj = await extractIds(input.trim());
    if (!idObj) {
      alert("Geçerli bir kanal, kullanıcı adı veya video linki giriniz.");
      return;
    }
    setItems((prev) => [...prev, { input: input.trim(), videoId: null, error: null }]);
    setInput("");
  };

  // Sil
  const handleRemove = (inputValue) => {
    const filtered = items.filter((i) => i.input !== inputValue);
    setItems(filtered);
  };

  // items güncellendikçe videoları yeniden çek
  useEffect(() => {
    if (items.length > 0) {
      updateVideos();
    }
    localStorage.setItem("channels", JSON.stringify(items));
  }, [items.length]);

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>YouTube Canlı Yayın İzleyici</h1>

      <div>
        <input
          style={{ width: "60%", padding: 8, fontSize: 16 }}
          placeholder="Kanal linki, @kullanıcıadı veya video linki girin"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          onClick={handleAdd}
          style={{ padding: "8px 12px", marginLeft: 8, fontSize: 16 }}
        >
          Ekle
        </button>
      </div>

      <ul
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "16px",
          padding: 0,
          marginTop: 20,
          listStyle: "none",
        }}
      >
        {items.map(({ input, videoId, error }, idx) => (
          <li
            key={idx}
            style={{
              flex: "1 1 300px",
              maxWidth: "560px",
              border: "1px solid #ccc",
              borderRadius: 6,
              padding: 10,
              boxSizing: "border-box",
              backgroundColor: "#fafafa",
            }}
          >
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              {input}
              <button
                onClick={() => handleRemove(input)}
                style={{
                  float: "right",
                  color: "white",
                  backgroundColor: "red",
                  border: "none",
                  padding: "4px 8px",
                  cursor: "pointer",
                  borderRadius: 4,
                }}
              >
                Sil
              </button>
            </div>

            {videoId ? (
              <div
                style={{
                  position: "relative",
                  paddingBottom: "56.25%", // 16:9 oranı
                  height: 0,
                  overflow: "hidden",
                  borderRadius: 8,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
                  title={input}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    borderRadius: 8,
                  }}
                />
              </div>
            ) : (
              <div style={{ color: "red", minHeight: 114 }}>{error}</div>)}
            </li>
        ))}
      </ul>
    </div>
  );
}