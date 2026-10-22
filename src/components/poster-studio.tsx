"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type Details = { name: string; company: string };
type Step = 1 | 2 | 3;
type PersonAdjustment = { x: number; y: number; scale: number };

const DEFAULT_ADJUSTMENT: PersonAdjustment = { x: 0, y: 0, scale: 1 };

const Icon = ({ name, size = 20 }: { name: "arrow" | "camera" | "download" | "refresh" | "upload" | "check" | "share" | "qr"; size?: number }) => {
  const paths = {
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    camera: <><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z" /><circle cx="12" cy="13" r="3.5" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    refresh: <><path d="M20 7h-5V2" /><path d="M20 7a9 9 0 1 0 1 8" /></>,
    upload: <><path d="M12 21V9" /><path d="m7 14 5-5 5 5" /><path d="M5 3h14" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>,
    qr: <><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="9" y="14" width="2" height="2" /><rect x="14" y="9" width="2" height="2" /><rect x="9" y="9" width="2" height="2" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function getVisibleBounds(image: HTMLImageElement) {
  const sampleScale = Math.min(1, 1200 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * sampleScale));
  canvas.height = Math.max(1, Math.round(image.height * sampleScale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      if (pixels[(y * canvas.width + x) * 4 + 3] > 20) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX || minY > maxY) return { x: 0, y: 0, width: image.width, height: image.height };
  const padding = 4;
  const x = Math.max(0, (minX - padding) / sampleScale);
  const y = Math.max(0, (minY - padding) / sampleScale);
  return {
    x,
    y,
    width: Math.min(image.width - x, (maxX - minX + padding * 2) / sampleScale),
    height: Math.min(image.height - y, (maxY - minY + padding * 2) / sampleScale),
  };
}

export default function PosterStudio() {
  const [step, setStep] = useState<Step>(1);
  const [details, setDetails] = useState<Details>({ name: "", company: "" });
  const [photo, setPhoto] = useState<string | null>(null);
  const [cutout, setCutout] = useState<string | null>(null);
  const [template, setTemplate] = useState("/api/template");
  const [poster, setPoster] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [cameraAspect, setCameraAspect] = useState(4 / 3);
  const [personAdjustment, setPersonAdjustment] = useState<PersonAdjustment>(DEFAULT_ADJUSTMENT);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustmentsSaved, setAdjustmentsSaved] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [uploadedPosterUrl, setUploadedPosterUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (step !== 2 || photo) return;
    let cancelled = false;
    setCameraError("");
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: facingMode }, width: { ideal: 1440 }, height: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((track) => track.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError("Camera access was blocked. You can upload a photo instead."));
    return () => { cancelled = true; stopCamera(); };
  }, [step, photo, facingMode]);

  const next = (event: FormEvent) => {
    event.preventDefault();
    if (details.name.trim() && details.company.trim()) setStep(2);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL("image/jpeg", 0.85));
    stopCamera();
  };

  const uploadPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) { setPhoto(URL.createObjectURL(file)); stopCamera(); }
  };

  const uploadTemplate = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) setTemplate(URL.createObjectURL(file));
  };

  const renderPoster = async (personUrl: string, adjustment: PersonAdjustment) => {
    await document.fonts.ready;
    const [background, person] = await Promise.all([loadImage(template), loadImage(personUrl)]);
    const canvas = document.createElement("canvas");
    const canvasWidth = background.naturalWidth || 2700;
    const canvasHeight = background.naturalHeight || 4800;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(background, 0, 0, canvasWidth, canvasHeight);

    const bounds = getVisibleBounds(person);
    // Keep the visible person below the conference title header
    const safePersonTop = Math.round(canvasHeight * 0.31);
    const maxPersonHeight = canvasHeight - safePersonTop;
    const maxPersonWidth = Math.round(canvasWidth * 0.62);
    const baseScale = Math.min(maxPersonHeight / bounds.height, maxPersonWidth / bounds.width);
    const scale = baseScale * adjustment.scale;
    const personWidth = bounds.width * scale;
    const personHeight = bounds.height * scale;
    const personX = canvasWidth - personWidth - Math.round(canvasWidth * 0.03) + adjustment.x;
    const personY = Math.min(canvasHeight - personHeight, canvasHeight - personHeight + adjustment.y);
    ctx.drawImage(person, bounds.x, bounds.y, bounds.width, bounds.height, personX, personY, personWidth, personHeight);

    // Left typography section for Full Name & Company Name
    const left = Math.round(canvasWidth * 0.075);
    const maxWidth = Math.round(canvasWidth * 0.44);

    // High contrast drop-shadow for text over the background
    ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 4;

    // 1. Full Name
    const words = details.name.trim().toUpperCase().split(/\s+/);
    ctx.fillStyle = "#ffffff";
    const nameFontSize = Math.round(canvasHeight * 0.042);
    const nameLineHeight = Math.round(nameFontSize * 0.92);
    ctx.font = `400 ${nameFontSize}px "Bebas Neue", sans-serif`;
    ctx.textBaseline = "top";

    let y = Math.round(canvasHeight * 0.72);
    const lines: string[] = [];
    let currentLine = "";
    words.forEach((word) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = candidate;
      }
    });
    if (currentLine) lines.push(currentLine);

    lines.slice(0, 3).forEach((lineText) => {
      ctx.fillText(lineText, left, y);
      y += nameLineHeight;
    });

    // 2. Gold Accent Divider
    y += Math.round(canvasHeight * 0.008);
    const dividerWidth = Math.min(220, maxWidth);
    ctx.fillStyle = "#EFB90B";
    ctx.fillRect(left, y, dividerWidth, Math.max(6, Math.round(canvasHeight * 0.0016)));

    // 3. Company Name
    y += Math.round(canvasHeight * 0.016);
    ctx.fillStyle = "#EFB90B";
    const companyFontSize = Math.round(canvasHeight * 0.015);
    const companyLineHeight = Math.round(companyFontSize * 1.3);
    ctx.font = `600 ${companyFontSize}px "Montserrat", sans-serif`;

    const companyWords = details.company.trim().toUpperCase().split(/\s+/);
    currentLine = "";
    companyWords.forEach((word, index) => {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(candidate).width > maxWidth && currentLine) {
        ctx.fillText(currentLine, left, y);
        y += companyLineHeight;
        currentLine = word;
      } else {
        currentLine = candidate;
      }
      if (index === companyWords.length - 1 && currentLine) {
        ctx.fillText(currentLine, left, y);
      }
    });

    // Reset shadow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    return canvas.toDataURL("image/jpeg", 0.90);
  };

  const createPoster = async () => {
    if (!photo) return;
    setProcessing(true);
    setProgress(8);
    try {
      const sourceResponse = await fetch(photo);
      const sourceBlob = await sourceResponse.blob();
      const formData = new FormData();
      formData.append("image", sourceBlob, "portrait.jpg");
      setProgress(25);
      const removalResponse = await fetch("/api/remove-background", { method: "POST", body: formData });
      if (!removalResponse.ok) {
        const failure = await removalResponse.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || "Background removal failed.");
      }
      const blob = await removalResponse.blob();
      const personUrl = URL.createObjectURL(blob);
      setCutout(personUrl);
      setProgress(82);
      const initialAdjustment = { ...DEFAULT_ADJUSTMENT };
      setPersonAdjustment(initialAdjustment);
      setAdjustmentsSaved(true);
      setPoster(await renderPoster(personUrl, initialAdjustment));
      setProgress(100);
      setStep(3);
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Background removal could not finish. Please try again.");
    } finally { setProcessing(false); }
  };

  const adjustPerson = async (change: Partial<PersonAdjustment>) => {
    if (!cutout || adjusting) return;
    const next = {
      x: change.x ?? personAdjustment.x,
      y: Math.min(0, change.y ?? personAdjustment.y),
      scale: change.scale ?? personAdjustment.scale,
    };
    setPersonAdjustment(next);
    setAdjustmentsSaved(false);
    setAdjusting(true);
    try { setPoster(await renderPoster(cutout, next)); }
    finally { setAdjusting(false); }
  };

  const download = () => {
    if (!poster) return;
    const link = document.createElement("a");
    link.href = poster;
    link.download = `${details.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "poster"}.jpeg`;
    link.click();
  };

  const uploadToCloudinary = async (): Promise<string> => {
    if (uploadedPosterUrl) return uploadedPosterUrl;
    if (!poster) throw new Error("No poster");

    const response = await fetch(poster);
    const blob = await response.blob();
    const formData = new FormData();
    formData.append("file", blob);
    formData.append("upload_preset", "idfc123");
    formData.append("folder", "idfc123");

    const uploadRes = await fetch("https://api.cloudinary.com/v1_1/derb7wswl/image/upload", {
      method: "POST",
      body: formData,
    });
    if (!uploadRes.ok) throw new Error("Upload failed");
    const data = await uploadRes.json();
    setUploadedPosterUrl(data.secure_url);
    return data.secure_url;
  };

  const sharePoster = async () => {
    if (!poster || sharing) return;
    setSharing(true);
    try {
      const url = await uploadToCloudinary();

      const response = await fetch(poster);
      const blob = await response.blob();
      const file = new File([blob], "poster.jpeg", { type: "image/jpeg" });

      const shareData: any = {
        title: "My Poster",
        text: "Check out my poster!",
      };

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        shareData.files = [file];
      } else {
        shareData.url = url;
      }

      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied to clipboard!");
      }
    } catch (error) {
      console.error("Share failed", error);
      alert("Failed to share poster. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const generateQr = async () => {
    if (!poster || generatingQr) return;
    setGeneratingQr(true);
    try {
      await uploadToCloudinary();
      setShowQr(true);
    } catch (error) {
      console.error("QR failed", error);
      alert("Failed to generate QR code. Please try again.");
    } finally {
      setGeneratingQr(false);
    }
  };

  const restart = () => {
    stopCamera(); setDetails({ name: "", company: "" }); setPhoto(null); setCutout(null); setPoster(null); setProgress(0); setPersonAdjustment(DEFAULT_ADJUSTMENT); setAdjustmentsSaved(true); setUploadedPosterUrl(null); setShowQr(false); setStep(1);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <section className="workspace">
        {step === 1 && (
          <div className="screen details-screen">
            <form className="form-card" onSubmit={next}>
              <div className="card-head"><div><h2>Your details</h2><p>This information will appear on your poster.</p></div></div>
              {([['name', 'Full name', 'e.g. Rahul Sharma'], ['company', 'Company name', 'e.g. Acme Corporation']] as const).map(([key, label, placeholder]) => (
                <label className="field" key={key}><span>{label}</span><input value={details[key]} onChange={(e) => setDetails({ ...details, [key]: e.target.value })} placeholder={placeholder} required autoComplete={key === "name" ? "name" : "organization"} /></label>
              ))}
              <button className="primary" type="submit">Continue to photo <Icon name="arrow" /></button>
              <p className="form-note"></p>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="screen capture-screen">
            {/* <div className="capture-copy"><span className="eyebrow">LOOK YOUR BEST</span><h1>Take your<br /><i>photo.</i></h1></div> */}
            <div className="camera-card">
              <div className="camera-frame" style={{ aspectRatio: cameraAspect }}>
                {photo ? <img src={photo} alt="Your captured photo" /> : <video className={facingMode === "environment" ? "back-camera" : ""} ref={videoRef} autoPlay playsInline muted onLoadedMetadata={(event) => { const video = event.currentTarget; if (video.videoWidth && video.videoHeight) setCameraAspect(video.videoWidth / video.videoHeight); }} />}
                {!photo && <div className="face-guide"><span /></div>}
                {cameraError && !photo && <div className="camera-error">{cameraError}</div>}
              </div>
              <div className="camera-actions">
                {!photo ? <><button className="secondary camera-switch" onClick={() => setFacingMode((mode) => mode === "user" ? "environment" : "user")}><Icon name="refresh" /> {facingMode === "user" ? "Back camera" : "Front camera"}</button><button className="primary" onClick={capture}><Icon name="camera" /> Capture photo</button></> : <><button className="secondary" onClick={() => setPhoto(null)}><Icon name="refresh" /> Retake</button><button className="primary" onClick={createPoster} disabled={processing}>{processing ? `Creating… ${progress}%` : "Create my poster"}<Icon name="arrow" /></button></>}
                {!photo && <label className="upload-link"><Icon name="upload" size={17} /> Or upload a photo<input type="file" accept="image/*" onChange={uploadPhoto} /></label>}
              </div>
              {processing && <div className="progress"><span style={{ width: `${progress}%` }} /></div>}
            </div>
          </div>
        )}

        {step === 3 && poster && (
          <div className="screen preview-screen">
            <div className="preview-copy">
              <span className="success-check"><Icon name="check" size={26} /></span>
              <span className="eyebrow"></span>
              <div className="editor-controls">
                <div className="editor-heading"><b>Adjust person</b><span>{adjusting ? "Updating…" : adjustmentsSaved ? "Saved" : "Unsaved"}</span></div>
                <div className="adjust-grid">
                  <button disabled={adjusting} onClick={() => adjustPerson({ x: personAdjustment.x - 40 })}>← Left</button>
                  <button disabled={adjusting} onClick={() => adjustPerson({ y: personAdjustment.y - 40 })}>↑ Up</button>
                  <button disabled={adjusting} onClick={() => adjustPerson({ x: personAdjustment.x + 40 })}>Right →</button>
                  <button disabled={adjusting} onClick={() => adjustPerson({ scale: Math.max(.65, personAdjustment.scale - .05) })}>− Smaller</button>
                  <button disabled={adjusting} onClick={() => adjustPerson({ y: personAdjustment.y + 40 })}>↓ Down</button>
                  <button disabled={adjusting} onClick={() => adjustPerson({ scale: Math.min(1.35, personAdjustment.scale + .05) })}>+ Bigger</button>
                </div>
                <button className="save-adjustment" disabled={adjusting || adjustmentsSaved} onClick={() => setAdjustmentsSaved(true)}><Icon name="check" size={16} /> Save position</button>
              </div>

              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center" }}>
                <button className="primary download" onClick={download}><Icon name="download" /> Download JPEG</button>
                <button className="primary share" onClick={sharePoster} disabled={sharing || generatingQr}><Icon name="share" /> {sharing ? "Uploading…" : "Share"}</button>
                <button className="primary qr" onClick={generateQr} disabled={sharing || generatingQr}><Icon name="qr" /> {generatingQr ? "Uploading…" : "QR Code"}</button>
              </div>
              <button className="start-over" onClick={restart}><Icon name="refresh" size={17} /> Start over</button>

              {showQr && uploadedPosterUrl && (
                <div className="qr-modal" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
                  <div style={{ background: "#fff", padding: "24px", borderRadius: "16px", textAlign: "center", color: "#000", maxWidth: "90vw" }}>
                    <h3 style={{ margin: "0 0 16px 0", fontSize: "1.2rem", fontWeight: 600 }}>Scan QR Code</h3>
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(uploadedPosterUrl)}`} alt="QR Code" width={250} height={250} style={{ display: "block", margin: "0 auto" }} />
                    <button onClick={() => setShowQr(false)} style={{ marginTop: "20px", width: "100%", padding: "12px", borderRadius: "8px", background: "#f0f0f0", border: "none", cursor: "pointer", fontWeight: 500, fontSize: "1rem" }}>Close</button>
                  </div>
                </div>
              )}
            </div>
            <div className={`poster-wrap ${adjusting ? "is-adjusting" : ""}`}><div className="poster-glow" /><img src={poster} alt={`Poster for ${details.name}`} /><span className="resolution">9:16 PORTRAIT</span></div>
          </div>
        )}
      </section>

      <label className="template-control" title="Upload the final empty branded template"><Icon name="upload" size={16} /><span>Replace template</span><input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadTemplate} /></label>
    </main>
  );
}
