"""
Генерирует PNG-диаграммы для диплома EduTest:
  - diagram_architecture.png  — архитектура системы
  - diagram_er.png            — ER-диаграмма базы данных
  - diagram_ai_sequence.png   — последовательность AI-анализа
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
import matplotlib.patheffects as pe

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")

# ─────────────────────────────────────────────────────────────────────────────
# Общие цвета
# ─────────────────────────────────────────────────────────────────────────────
C_BLUE   = "#2563EB"
C_LBLUE  = "#DBEAFE"
C_GREEN  = "#16A34A"
C_LGREEN = "#DCFCE7"
C_PURPLE = "#7C3AED"
C_LPUR   = "#EDE9FE"
C_ORANGE = "#EA580C"
C_LORAN  = "#FFEDD5"
C_GRAY   = "#6B7280"
C_LGRAY  = "#F3F4F6"
C_BORDER = "#374151"
C_TEXT   = "#111827"


def box(ax, x, y, w, h, label, sub="", fc="#DBEAFE", ec="#2563EB", fs=11, fsub=9):
    rect = FancyBboxPatch((x - w/2, y - h/2), w, h,
                          boxstyle="round,pad=0.05", fc=fc, ec=ec, lw=1.8, zorder=3)
    ax.add_patch(rect)
    if sub:
        ax.text(x, y + 0.08, label, ha="center", va="center",
                fontsize=fs, fontweight="bold", color=C_TEXT, zorder=4)
        ax.text(x, y - 0.18, sub, ha="center", va="center",
                fontsize=fsub, color=C_GRAY, zorder=4)
    else:
        ax.text(x, y, label, ha="center", va="center",
                fontsize=fs, fontweight="bold", color=C_TEXT, zorder=4)


def arrow(ax, x1, y1, x2, y2, label="", color="#374151", two_way=False):
    style = "<->" if two_way else "->"
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color, lw=1.6,
                                connectionstyle="arc3,rad=0.0"), zorder=2)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx, my + 0.05, label, ha="center", va="bottom",
                fontsize=8, color=color)


# ═══════════════════════════════════════════════════════════════════════════
# 1. Архитектура
# ═══════════════════════════════════════════════════════════════════════════
def draw_architecture():
    fig, ax = plt.subplots(figsize=(14, 7))
    ax.set_xlim(0, 14); ax.set_ylim(0, 7)
    ax.axis("off")
    fig.patch.set_facecolor("white")

    # ── Зоны ──────────────────────────────────────────────────────────────
    for (x, y, w, h, label, fc, ec) in [
        (2.4, 3.2, 4.0, 4.8, "КЛИЕНТ", "#EFF6FF", "#93C5FD"),
        (7.0, 3.2, 2.6, 4.8, "СЕРВЕР", "#F0FDF4", "#86EFAC"),
        (11.3, 3.2, 3.8, 4.8, "ВНЕШНИЕ СЕРВИСЫ", "#FFF7ED", "#FDBA74"),
    ]:
        zone = FancyBboxPatch((x - w/2, y - h/2), w, h,
                              boxstyle="round,pad=0.1", fc=fc, ec=ec, lw=2, zorder=1, ls="--")
        ax.add_patch(zone)
        ax.text(x, y + h/2 - 0.25, label, ha="center", va="top",
                fontsize=9, color=ec, fontweight="bold")

    # ── Блоки клиента ─────────────────────────────────────────────────────
    box(ax, 1.5, 4.8, 2.2, 0.7, "Преподаватель", fc=C_LBLUE, ec=C_BLUE)
    box(ax, 3.3, 4.8, 2.2, 0.7, "Студент",       fc=C_LBLUE, ec=C_BLUE)
    box(ax, 2.4, 3.5, 3.2, 0.8, "React + Vite", "TypeScript / shadcn UI", fc=C_LBLUE, ec=C_BLUE)
    box(ax, 2.4, 2.1, 3.2, 0.8, "TanStack Query", "Кэш + HTTP-запросы", fc=C_LBLUE, ec=C_BLUE)

    # ── Блоки сервера ─────────────────────────────────────────────────────
    box(ax, 7.0, 4.8, 2.2, 0.7, "Express.js", "REST API", fc=C_LGREEN, ec=C_GREEN)
    box(ax, 7.0, 3.5, 2.2, 0.8, "Drizzle ORM", "Типизация БД", fc=C_LGREEN, ec=C_GREEN)
    box(ax, 7.0, 2.1, 2.2, 0.8, "SQLite", "Хранилище данных", fc=C_LGREEN, ec=C_GREEN)

    # ── Внешние сервисы ───────────────────────────────────────────────────
    box(ax, 11.3, 4.8, 3.0, 0.7, "Groq API", fc=C_LORAN, ec=C_ORANGE)
    box(ax, 11.3, 3.5, 3.0, 0.8, "Llama 3.3-70B", "Языковая модель", fc=C_LORAN, ec=C_ORANGE)
    box(ax, 11.3, 2.1, 3.0, 0.7, "bcrypt / express-session", fc=C_LPUR, ec=C_PURPLE, fs=9)

    # ── Стрелки ───────────────────────────────────────────────────────────
    arrow(ax, 1.5, 4.45, 2.4, 3.9, two_way=True, color=C_BLUE)
    arrow(ax, 3.3, 4.45, 2.4, 3.9, two_way=True, color=C_BLUE)
    arrow(ax, 2.4, 3.1,  2.4, 2.5, two_way=True, color=C_BLUE)
    arrow(ax, 4.0, 2.1,  5.9, 4.8, two_way=True, color=C_GRAY, label="HTTP / JSON")
    arrow(ax, 7.0, 4.45, 7.0, 3.9, two_way=True, color=C_GREEN)
    arrow(ax, 7.0, 3.1,  7.0, 2.5, two_way=True, color=C_GREEN)
    arrow(ax, 8.1, 4.8,  9.8, 4.8, two_way=True, color=C_ORANGE, label="HTTPS / JSON")
    arrow(ax, 9.8, 3.5,  8.1, 3.5, two_way=False, color=C_ORANGE)

    plt.tight_layout()
    path = os.path.join(OUT, "diagram_architecture.png")
    plt.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close()
    print(f"Сохранено: {path}")


# ═══════════════════════════════════════════════════════════════════════════
# 2. ER-диаграмма
# ═══════════════════════════════════════════════════════════════════════════
def er_table(ax, x, y, title, fields, fc, ec, col_w=3.6, row_h=0.38):
    n = len(fields)
    total_h = (n + 1) * row_h
    # Заголовок
    hdr = FancyBboxPatch((x, y - row_h), col_w, row_h,
                         boxstyle="square,pad=0", fc=ec, ec=ec, lw=0, zorder=3)
    ax.add_patch(hdr)
    ax.text(x + col_w/2, y - row_h/2, title, ha="center", va="center",
            fontsize=9, fontweight="bold", color="white", zorder=4)
    # Поля
    for i, (name, typ) in enumerate(fields):
        ry = y - (i + 2) * row_h
        bg = fc if i % 2 == 0 else "white"
        cell = FancyBboxPatch((x, ry), col_w, row_h,
                              boxstyle="square,pad=0", fc=bg, ec="#CBD5E1", lw=0.5, zorder=3)
        ax.add_patch(cell)
        ax.text(x + 0.12, ry + row_h/2, name, ha="left", va="center",
                fontsize=8, color=C_TEXT, zorder=4)
        ax.text(x + col_w - 0.12, ry + row_h/2, typ, ha="right", va="center",
                fontsize=7.5, color=C_GRAY, zorder=4)
    # Рамка
    border = FancyBboxPatch((x, y - total_h), col_w, total_h,
                             boxstyle="square,pad=0", fc="none", ec=ec, lw=1.5, zorder=5)
    ax.add_patch(border)
    return x + col_w/2, y - total_h/2  # центр таблицы


def draw_er():
    fig, ax = plt.subplots(figsize=(16, 11))
    ax.set_xlim(0, 16); ax.set_ylim(-1, 11)
    ax.axis("off")
    fig.patch.set_facecolor("white")

    tables = {
        "users": {
            "pos": (0.3, 10.2),
            "fc": "#EFF6FF", "ec": "#2563EB",
            "fields": [("PK id", "UUID"), ("username", "TEXT"), ("password", "TEXT"),
                       ("fullName", "TEXT"), ("role", "student|teacher"), ("photoUrl", "TEXT")],
        },
        "tests": {
            "pos": (5.0, 10.2),
            "fc": "#F0FDF4", "ec": "#16A34A",
            "fields": [("PK id", "UUID"), ("teacherId →", "UUID"), ("title", "TEXT"),
                       ("subject", "TEXT"), ("timeLimitMin", "INT"), ("isPublished", "BOOL"),
                       ("isCompetitive", "BOOL")],
        },
        "questions": {
            "pos": (9.8, 10.2),
            "fc": "#FFF7ED", "ec": "#EA580C",
            "fields": [("PK id", "UUID"), ("testId →", "UUID"), ("type", "single|multi|open"),
                       ("text", "TEXT"), ("points", "INT"), ("correctAnswer", "TEXT")],
        },
        "question_options": {
            "pos": (13.0, 7.5),
            "fc": "#FDF4FF", "ec": "#A21CAF",
            "fields": [("PK id", "UUID"), ("questionId →", "UUID"),
                       ("text", "TEXT"), ("isCorrect", "BOOL")],
        },
        "test_attempts": {
            "pos": (5.0, 5.8),
            "fc": "#FFFBEB", "ec": "#D97706",
            "fields": [("PK id", "UUID"), ("testId →", "UUID"), ("studentId →", "UUID"),
                       ("status", "active|completed"), ("score", "REAL"),
                       ("maxScore", "INT"), ("startedAt", "TIMESTAMP"), ("completedAt", "TIMESTAMP")],
        },
        "answers": {
            "pos": (9.8, 5.8),
            "fc": "#FFF1F2", "ec": "#E11D48",
            "fields": [("PK id", "UUID"), ("attemptId →", "UUID"), ("questionId →", "UUID"),
                       ("answerText", "TEXT"), ("pointsAwarded", "REAL"),
                       ("aiFeedback", "TEXT"), ("aiScore", "REAL")],
        },
        "teacher_students": {
            "pos": (0.3, 5.8),
            "fc": "#F0FDF4", "ec": "#059669",
            "fields": [("PK id", "UUID"), ("teacherId →", "UUID"), ("studentId →", "UUID")],
        },
    }

    centers = {}
    for name, cfg in tables.items():
        cx, cy = er_table(ax, cfg["pos"][0], cfg["pos"][1], name,
                          cfg["fields"], cfg["fc"], cfg["ec"])
        centers[name] = (cfg["pos"][0], cfg["pos"][1],
                         cfg["pos"][0] + 3.6, cfg["pos"][1] - (len(cfg["fields"]) + 1) * 0.38)

    def conn(t1, t2, label1="1", label2="N", color="#94A3B8"):
        x1c = (centers[t1][0] + centers[t1][2]) / 2
        y1c = (centers[t1][1] + centers[t1][3]) / 2
        x2c = (centers[t2][0] + centers[t2][2]) / 2
        y2c = (centers[t2][1] + centers[t2][3]) / 2
        ax.annotate("", xy=(x2c, y2c), xytext=(x1c, y1c),
                    arrowprops=dict(arrowstyle=f"-|>", color=color, lw=1.4,
                                   connectionstyle="arc3,rad=0.05"), zorder=6)
        mx, my = (x1c + x2c) / 2, (y1c + y2c) / 2
        ax.text(mx + 0.1, my + 0.1, f"{label1}:{label2}", ha="center",
                fontsize=8, color=color, fontweight="bold",
                bbox=dict(fc="white", ec="none", pad=1))

    conn("users",        "tests",          "1", "N", C_BLUE)
    conn("users",        "test_attempts",  "1", "N", C_BLUE)
    conn("tests",        "questions",      "1", "N", C_GREEN)
    conn("questions",    "question_options","1","N", C_ORANGE)
    conn("tests",        "test_attempts",  "1", "N", C_GREEN)
    conn("test_attempts","answers",        "1", "N", "#D97706")
    conn("questions",    "answers",        "1", "N", C_ORANGE)
    conn("users",        "teacher_students","1","N", "#059669")

    plt.tight_layout()
    path = os.path.join(OUT, "diagram_er.png")
    plt.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close()
    print(f"Сохранено: {path}")


# ═══════════════════════════════════════════════════════════════════════════
# 3. Sequence — AI-анализ
# ═══════════════════════════════════════════════════════════════════════════
def draw_sequence():
    fig, ax = plt.subplots(figsize=(14, 9))
    ax.set_xlim(0, 14); ax.set_ylim(0, 9)
    ax.axis("off")
    fig.patch.set_facecolor("white")

    actors = [
        (1.4, "Студент",        C_LBLUE,  C_BLUE),
        (4.2, "Веб-клиент\n(React)", C_LGREEN, C_GREEN),
        (7.0, "Сервер\n(Express)", C_LORAN,  C_ORANGE),
        (9.8, "SQLite\n(БД)",    C_LGRAY,  C_GRAY),
        (12.6,"Groq API\n(ИИ)", C_LPUR,   C_PURPLE),
    ]

    # Шапки участников
    for x, label, fc, ec in actors:
        box(ax, x, 8.0, 1.9, 0.7, label, fc=fc, ec=ec, fs=9)

    # Линии жизни
    for x, *_ in actors:
        ax.plot([x, x], [7.65, 0.3], color="#CBD5E1", lw=1.2, ls="--", zorder=1)

    # Шаги
    steps = [
        # (от_x, до_x, y, label, color, ответная?)
        (1.4,  4.2, 7.2, "Вводит открытый ответ",       C_BLUE,   False),
        (4.2,  7.0, 6.6, "POST /api/tests/:id/submit",   C_GREEN,  False),
        (7.0,  9.8, 6.0, "SELECT вопрос + эталон",       C_GRAY,   False),
        (9.8,  7.0, 5.5, "Возвращает данные",            C_GRAY,   True),
        (7.0, 12.6, 4.9, "Запрос к Groq API (промпт)",  C_ORANGE, False),
        (12.6, 7.0, 4.3, "JSON: балл + комментарий",     C_PURPLE, True),
        (7.0,  9.8, 3.7, "UPDATE answers (aiScore, feedback)", C_GRAY, False),
        (9.8,  7.0, 3.2, "OK",                           C_GRAY,   True),
        (7.0,  4.2, 2.6, "Результат + AI-анализ",        C_ORANGE, True),
        (4.2,  1.4, 2.0, "Отображает результат",         C_GREEN,  True),
    ]

    for i, (x1, x2, y, label, color, is_return) in enumerate(steps):
        ls = "--" if is_return else "-"
        ax.annotate("", xy=(x2, y), xytext=(x1, y),
                    arrowprops=dict(arrowstyle="-|>", color=color, lw=1.5,
                                   linestyle=ls, connectionstyle="arc3,rad=0"), zorder=3)
        mx = (x1 + x2) / 2
        offset = 0.13 if not is_return else -0.13
        ax.text(mx, y + offset, f"{i+1}. {label}", ha="center", va="center",
                fontsize=8.5, color=color, fontweight="bold" if not is_return else "normal",
                bbox=dict(fc="white", ec="none", pad=1), zorder=4)

    # Активации (прямоугольники на линиях жизни)
    for x, top, bot, fc in [
        (7.0, 6.65, 2.55, "#FED7AA"),
        (12.6, 4.95, 4.25, "#DDD6FE"),
        (9.8,  6.05, 3.15, "#E5E7EB"),
    ]:
        rect = FancyBboxPatch((x - 0.12, bot), 0.24, top - bot,
                              boxstyle="square,pad=0", fc=fc, ec="#9CA3AF", lw=1, zorder=2)
        ax.add_patch(rect)

    plt.tight_layout()
    path = os.path.join(OUT, "diagram_ai_sequence.png")
    plt.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close()
    print(f"Сохранено: {path}")


if __name__ == "__main__":
    draw_architecture()
    draw_er()
    draw_sequence()
    print("\nВсе диаграммы готовы в папке docs/")
