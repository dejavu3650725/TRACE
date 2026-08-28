from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas


OUTPUT = Path("output/pdf/issue-28-synthetic-batch.pdf")
PAGE_GROUPS = [
    ("Synthetic Student A", 1, 2),
    ("Synthetic Student B", 2, 1),
    ("Synthetic Student C", 3, 3),
    ("Synthetic Student D", 4, 2),
    ("Synthetic Student E", 5, 1),
    ("Synthetic Student F", 6, 3),
]


def draw_page(pdf: canvas.Canvas, student_name: str, student_number: int, group_page: int, group_total: int, absolute_page: int) -> None:
    width, height = A4
    navy = colors.HexColor("#172033")
    brand = colors.HexColor("#4F46E5")
    muted = colors.HexColor("#64748B")
    line = colors.HexColor("#CBD5E1")

    pdf.setFillColor(colors.HexColor("#F8FAFC"))
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    pdf.setFillColor(brand)
    pdf.rect(0, height - 18 * mm, width, 18 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(18 * mm, height - 11.5 * mm, "TRACE - Synthetic Batch Activity")

    pdf.setFillColor(navy)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(18 * mm, height - 34 * mm, "Fractions and Explanations")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(muted)
    pdf.drawString(18 * mm, height - 41 * mm, "Synthetic fixture for Issue 28 page-range inspection")

    pdf.setFillColor(colors.white)
    pdf.setStrokeColor(line)
    pdf.roundRect(18 * mm, height - 63 * mm, width - 36 * mm, 14 * mm, 3 * mm, fill=1, stroke=1)
    pdf.setFillColor(navy)
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawString(23 * mm, height - 57 * mm, f"Student {student_number}: {student_name}")
    pdf.setFont("Helvetica", 10)
    pdf.setFillColor(muted)
    pdf.drawRightString(width - 23 * mm, height - 57 * mm, f"Sheet {group_page} of {group_total}")

    questions = [
        "1. Shade a model that represents the fraction shown.",
        "2. Explain how you know two fractions are equivalent.",
        "3. Write one question you still have about fractions.",
    ]
    y = height - 82 * mm
    for question_index, question in enumerate(questions, start=1):
        pdf.setFillColor(navy)
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(20 * mm, y, question)
        y -= 9 * mm
        if question_index == 1:
            box_size = 17 * mm
            for box_index in range(6):
                x = 22 * mm + box_index * box_size
                pdf.setStrokeColor(line)
                pdf.setFillColor(colors.HexColor("#EEF2FF") if box_index < (student_number % 5) + 1 else colors.white)
                pdf.rect(x, y - box_size, box_size, box_size, fill=1, stroke=1)
            y -= 28 * mm
        else:
            pdf.setStrokeColor(line)
            for _ in range(4):
                pdf.line(22 * mm, y, width - 22 * mm, y)
                y -= 9 * mm
            y -= 8 * mm

    pdf.setStrokeColor(line)
    pdf.line(18 * mm, 17 * mm, width - 18 * mm, 17 * mm)
    pdf.setFillColor(muted)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(18 * mm, 11 * mm, "Synthetic data only - no real student information")
    pdf.drawRightString(width - 18 * mm, 11 * mm, f"Batch page {absolute_page} / 12")
    pdf.showPage()


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdf = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    absolute_page = 1
    for student_name, student_number, page_total in PAGE_GROUPS:
        for group_page in range(1, page_total + 1):
            draw_page(pdf, student_name, student_number, group_page, page_total, absolute_page)
            absolute_page += 1
    pdf.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
