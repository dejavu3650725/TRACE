from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


OUTPUT = Path("output/pdf/issue-29-synthetic-shuffled-batch.pdf")
FONT_PATH = "/System/Library/Fonts/Supplemental/AppleGothic.ttf"
FONT_NAME = "TraceKorean"
STUDENTS = [
    {"number": 3, "name": "최하린", "answer": "3/5", "reason": "분모가 같을 때 분자가 3인 분수가 더 큽니다."},
    {"number": 1, "name": "강서윤", "answer": "3/5", "reason": "5칸 중 3칸이 2칸보다 더 많기 때문입니다."},
    {"number": 4, "name": "김겸율", "answer": "3/5", "reason": "두 분수의 분모가 같고 3이 2보다 큽니다."},
    {"number": 2, "name": "박도윤", "answer": "3/5", "reason": "같은 크기로 나눈 조각을 3개 고른 쪽이 더 큽니다."},
]


def draw_label(pdf: canvas.Canvas, x: float, y: float, label: str, value: str, width: float) -> None:
    pdf.setStrokeColor(colors.HexColor("#CBD5E1"))
    pdf.setFillColor(colors.white)
    pdf.roundRect(x, y, width, 13 * mm, 2.5 * mm, fill=1, stroke=1)
    pdf.setFont(FONT_NAME, 8.5)
    pdf.setFillColor(colors.HexColor("#64748B"))
    pdf.drawString(x + 4 * mm, y + 8.3 * mm, label)
    pdf.setFont(FONT_NAME, 12)
    pdf.setFillColor(colors.HexColor("#172033"))
    pdf.drawString(x + 4 * mm, y + 3.2 * mm, value)


def draw_answer_box(pdf: canvas.Canvas, x: float, y: float, width: float, height: float, answer: str) -> None:
    pdf.setStrokeColor(colors.HexColor("#A5B4FC"))
    pdf.setFillColor(colors.HexColor("#F8FAFF"))
    pdf.roundRect(x, y, width, height, 3 * mm, fill=1, stroke=1)
    pdf.setFillColor(colors.HexColor("#1D4ED8"))
    pdf.setFont(FONT_NAME, 15)
    pdf.drawString(x + 5 * mm, y + height - 10 * mm, answer)


def draw_page(pdf: canvas.Canvas, student: dict[str, object], page_number: int) -> None:
    width, height = A4
    navy = colors.HexColor("#172033")
    brand = colors.HexColor("#4F46E5")
    muted = colors.HexColor("#64748B")

    pdf.setFillColor(colors.HexColor("#F8FAFC"))
    pdf.rect(0, 0, width, height, fill=1, stroke=0)
    pdf.setFillColor(brand)
    pdf.rect(0, height - 20 * mm, width, 20 * mm, fill=1, stroke=0)
    pdf.setFillColor(colors.white)
    pdf.setFont(FONT_NAME, 17)
    pdf.drawString(18 * mm, height - 12.5 * mm, "TRACE 합성 수학 활동지")
    pdf.setFont(FONT_NAME, 9)
    pdf.drawRightString(width - 18 * mm, height - 12.5 * mm, "이슈 29 - 학생 및 답안 인식 시연")

    pdf.setFillColor(navy)
    pdf.setFont(FONT_NAME, 21)
    pdf.drawString(18 * mm, height - 37 * mm, "분모가 같은 분수의 크기 비교")
    pdf.setFillColor(muted)
    pdf.setFont(FONT_NAME, 10)
    pdf.drawString(18 * mm, height - 44 * mm, "PDF의 페이지 순서와 학생 번호 순서는 의도적으로 다릅니다.")

    gap = 3 * mm
    field_width = (width - 36 * mm - gap * 3) / 4
    field_y = height - 65 * mm
    values = [("학년", "3"), ("반", "1"), ("번호", str(student["number"])), ("이름", str(student["name"]))]
    for index, (label, value) in enumerate(values):
        draw_label(pdf, 18 * mm + index * (field_width + gap), field_y, label, value, field_width)

    q1_y = height - 91 * mm
    pdf.setFillColor(navy)
    pdf.setFont(FONT_NAME, 12)
    pdf.drawString(18 * mm, q1_y, "Q1. 3/5와 2/5 중 더 큰 분수를 쓰세요.")
    draw_answer_box(pdf, 18 * mm, q1_y - 30 * mm, width - 36 * mm, 22 * mm, str(student["answer"]))

    q2_y = q1_y - 47 * mm
    pdf.setFillColor(navy)
    pdf.setFont(FONT_NAME, 12)
    pdf.drawString(18 * mm, q2_y, "Q2. 그렇게 생각한 이유를 한 문장으로 쓰세요.")
    draw_answer_box(pdf, 18 * mm, q2_y - 43 * mm, width - 36 * mm, 35 * mm, str(student["reason"]))

    pdf.setFillColor(colors.HexColor("#EEF2FF"))
    pdf.roundRect(18 * mm, 36 * mm, width - 36 * mm, 30 * mm, 3 * mm, fill=1, stroke=0)
    pdf.setFillColor(navy)
    pdf.setFont(FONT_NAME, 10)
    pdf.drawString(23 * mm, 57 * mm, "확인 메모")
    pdf.setFillColor(muted)
    pdf.setFont(FONT_NAME, 9)
    pdf.drawString(23 * mm, 49 * mm, "- 이 문서는 테스트·시연 전용 합성 자료입니다.")
    pdf.drawString(23 * mm, 42 * mm, "- 이름과 번호는 서버의 합성 명단과 완전히 일치할 때만 연결됩니다.")

    pdf.setStrokeColor(colors.HexColor("#CBD5E1"))
    pdf.line(18 * mm, 20 * mm, width - 18 * mm, 20 * mm)
    pdf.setFillColor(muted)
    pdf.setFont(FONT_NAME, 8)
    pdf.drawString(18 * mm, 13 * mm, "Synthetic data only - no real student information")
    pdf.drawRightString(width - 18 * mm, 13 * mm, f"Batch page {page_number} / {len(STUDENTS)}")
    pdf.showPage()


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    pdfmetrics.registerFont(TTFont(FONT_NAME, FONT_PATH))
    pdf = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
    pdf.setTitle("TRACE Issue 29 Synthetic Shuffled Batch")
    pdf.setAuthor("TRACE synthetic fixture")
    for page_number, student in enumerate(STUDENTS, start=1):
        draw_page(pdf, student, page_number)
    pdf.save()
    print(OUTPUT)


if __name__ == "__main__":
    main()
