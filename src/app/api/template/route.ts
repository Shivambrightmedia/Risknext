import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const templateDir = path.join(process.cwd(), "Template_Image");
  if (fs.existsSync(templateDir)) {
    const files = fs.readdirSync(templateDir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
    if (files.length > 0) {
      const filePath = path.join(templateDir, files[0]);
      const buffer = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-store, max-age=0",
        },
      });
    }
  }

  const publicFallback = path.join(process.cwd(), "public", "template.png");
  if (fs.existsSync(publicFallback)) {
    const buffer = fs.readFileSync(publicFallback);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  }

  return NextResponse.json({ error: "Template not found" }, { status: 404 });
}
