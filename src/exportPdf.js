import { renderScene, filename } from "./lib";
export async function exportPdf(design, products, progress) {
  const entries = Object.entries(design.placements).filter(
    ([, logos]) => logos.length,
  );
  if (!entries.length)
    throw new Error("Lisää vähintään yksi logo ennen yhteenvedon lataamista.");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true }),
    title = design.title || "Oma työvaatemallisto";
  pdf.setProperties({
    title,
    subject: "Fristads Logo Studio – suunnitelman esikatselu",
    creator: "Fristads Logo Studio",
  });
  for (let i = 0; i < entries.length; i++) {
    progress?.(`${i + 1} / ${entries.length}`);
    const [key, logos] = entries[i],
      [id, viewString] = key.split(":"),
      view = Number(viewString),
      product = products.find((p) => p.id === id);
    if (!product || !product.images[view])
      throw new Error(
        `Tuotteen ${id} kuvakulma puuttuu. Lisää tuote uudelleen ennen PDF-vientiä.`,
      );
    const canvas = await renderScene(product, view, logos, 1600);
    if (i) pdf.addPage();
    pdf.setFillColor("#173c30");
    pdf.rect(0, 0, 210, 34, "F");
    pdf.setTextColor("#ffffff");
    pdf.setFont("helvetica", "bolditalic");
    pdf.setFontSize(22);
    pdf.text("FRISTADS", 16, 21);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("LOGO STUDIO / SUUNNITELMA", 194, 20, { align: "right" });
    pdf.setTextColor("#1b3027");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(19);
    pdf.text(pdf.splitTextToSize(title, 176).slice(0, 2), 16, 48);
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.94),
      "JPEG",
      23,
      66,
      164,
      164,
    );
    pdf.setDrawColor("#d9e0d9");
    pdf.line(16, 237, 194, 237);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(pdf.splitTextToSize(product.name, 170).slice(0, 2), 16, 247);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor("#55645c");
    pdf.text(
      `${product.id}  |  ${product.color || "Fristads"}  |  Kuvakulma ${view + 1}  |  Logoja ${logos.length}`,
      16,
      260,
    );
    pdf.textWithLink("Avaa tuote Fristadsin sivuilla", 16, 269, {
      url: product.url,
    });
    pdf.setFontSize(7);
    pdf.text(
      "Suuntaa antava esikatselu. Painatusmitat ja toteutettavuus vahvistetaan erikseen.",
      16,
      285,
    );
    pdf.text(`${i + 1} / ${entries.length}`, 194, 285, { align: "right" });
  }
  pdf.save(filename(title) + ".pdf");
}
