"""
Генерирует:
  - diagram_usecase.png     — Use-case диаграмма (§2.1)
  - diagram_components.png  — Диаграмма компонентов (§2.4)
"""
import os
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.patches import FancyBboxPatch, Ellipse, Arc
import math

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "docs")

C_BLUE   = "#2563EB"; C_LBLUE  = "#DBEAFE"
C_GREEN  = "#16A34A"; C_LGREEN = "#DCFCE7"
C_PURPLE = "#7C3AED"; C_LPUR   = "#EDE9FE"
C_ORANGE = "#EA580C"; C_LORAN  = "#FFEDD5"
C_GRAY   = "#6B7280"; C_LGRAY  = "#F3F4F6"
C_TEXT   = "#111827"; C_BORDER = "#374151"


# ══════════════════════════════════════════════════════════════════════════════
# 1. USE-CASE
# ══════════════════════════════════════════════════════════════════════════════
def stick_figure(ax, x, y, label, color="#1E40AF"):
    """Рисует человечка UML."""
    # голова
    head = plt.Circle((x, y + 0.55), 0.18, fc="white", ec=color, lw=1.8, zorder=4)
    ax.add_patch(head)
    # тело
    ax.plot([x, x],         [y + 0.37, y - 0.1],  color=color, lw=1.8, zorder=4)
    # руки
    ax.plot([x - 0.28, x + 0.28], [y + 0.15, y + 0.15], color=color, lw=1.8, zorder=4)
    # ноги
    ax.plot([x, x - 0.22], [y - 0.1, y - 0.5],   color=color, lw=1.8, zorder=4)
    ax.plot([x, x + 0.22], [y - 0.1, y - 0.5],   color=color, lw=1.8, zorder=4)
    ax.text(x, y - 0.72, label, ha="center", va="top", fontsize=9,
            fontweight="bold", color=color, zorder=4)


def use_case(ax, x, y, text, fc="#DBEAFE", ec="#2563EB", w=2.6, h=0.6):
    el = Ellipse((x, y), w, h, fc=fc, ec=ec, lw=1.6, zorder=3)
    ax.add_patch(el)
    # перенос длинного текста
    words = text.split()
    if len(words) > 3:
        mid = len(words) // 2
        line1 = " ".join(words[:mid])
        line2 = " ".join(words[mid:])
        ax.text(x, y + 0.1, line1, ha="center", va="center", fontsize=8, color=C_TEXT, zorder=4)
        ax.text(x, y - 0.1, line2, ha="center", va="center", fontsize=8, color=C_TEXT, zorder=4)
    else:
        ax.text(x, y, text, ha="center", va="center", fontsize=8.5, color=C_TEXT, zorder=4)


def draw_usecase():
    fig, ax = plt.subplots(figsize=(16, 10))
    ax.set_xlim(0, 16); ax.set_ylim(0, 10)
    ax.axis("off")
    fig.patch.set_facecolor("white")

    # ── Граница системы ────────────────────────────────────────────────────
    sys_box = FancyBboxPatch((2.8, 0.5), 10.4, 8.8,
                             boxstyle="round,pad=0.1", fc="#F8FAFC", ec="#94A3B8",
                             lw=2, ls="--", zorder=1)
    ax.add_patch(sys_box)
    ax.text(8.0, 9.5, "Система EduTest", ha="center", va="center",
            fontsize=11, color="#475569", style="italic")

    # ── Акторы ────────────────────────────────────────────────────────────
    stick_figure(ax, 1.2, 7.0, "Преподаватель", C_BLUE)
    stick_figure(ax, 1.2, 3.0, "Студент",       C_GREEN)
    stick_figure(ax, 14.8, 5.0, "Groq AI",      C_PURPLE)

    # ── Прецеденты преподавателя ──────────────────────────────────────────
    teacher_cases = [
        (5.5, 8.2, "Регистрация / Вход"),
        (5.5, 7.0, "Создание теста"),
        (5.5, 5.8, "Редактирование теста"),
        (5.5, 4.6, "Публикация теста"),
        (5.5, 3.4, "Просмотр результатов"),
        (5.5, 2.2, "Управление студентами"),
        (5.5, 1.1, "Экспорт данных"),
    ]
    for x, y, t in teacher_cases:
        use_case(ax, x, y, t, fc=C_LBLUE, ec=C_BLUE)
        # линия к актору
        ax.annotate("", xy=(3.0, y), xytext=(1.6, 7.0 if y > 5 else 3.0),
                    arrowprops=dict(arrowstyle="-", color="#93C5FD", lw=1.2), zorder=2)

    # ── Прецеденты студента ───────────────────────────────────────────────
    student_cases = [
        (10.5, 8.2, "Регистрация / Вход"),
        (10.5, 7.0, "Просмотр тестов"),
        (10.5, 5.8, "Прохождение теста"),
        (10.5, 4.6, "Просмотр результатов"),
        (10.5, 3.4, "AI-анализ успеваемости"),
        (10.5, 2.2, "Просмотр прогресса"),
        (10.5, 1.1, "Рейтинг / Лидерборд"),
    ]
    for x, y, t in student_cases:
        use_case(ax, x, y, t, fc=C_LGREEN, ec=C_GREEN)
        ax.annotate("", xy=(12.0, y), xytext=(1.6, 3.0),
                    arrowprops=dict(arrowstyle="-", color="#86EFAC", lw=1.2), zorder=2)

    # ── Groq связи ────────────────────────────────────────────────────────
    for y in [5.8, 3.4]:
        ax.annotate("", xy=(14.3, 5.0), xytext=(11.8, y),
                    arrowprops=dict(arrowstyle="-", color="#C4B5FD", lw=1.2,
                                   connectionstyle="arc3,rad=0.15"), zorder=2)

    # ── Легенда ───────────────────────────────────────────────────────────
    legend_items = [
        mpatches.Patch(fc=C_LBLUE,  ec=C_BLUE,   label="Функции преподавателя"),
        mpatches.Patch(fc=C_LGREEN, ec=C_GREEN,  label="Функции студента"),
        mpatches.Patch(fc=C_LPUR,   ec=C_PURPLE, label="Внешний AI-сервис"),
    ]
    ax.legend(handles=legend_items, loc="lower right", fontsize=9,
              framealpha=0.95, edgecolor="#CBD5E1")

    plt.tight_layout()
    path = os.path.join(OUT, "diagram_usecase.png")
    plt.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close()
    print(f"Сохранено: {path}")


# ══════════════════════════════════════════════════════════════════════════════
# 2. КОМПОНЕНТНАЯ ДИАГРАММА
# ══════════════════════════════════════════════════════════════════════════════
def component_box(ax, x, y, w, h, title, items, fc, ec, title_fc=None):
    if title_fc is None:
        title_fc = ec
    # Тело
    body = FancyBboxPatch((x, y - h), w, h,
                          boxstyle="round,pad=0.06", fc=fc, ec=ec, lw=2, zorder=3)
    ax.add_patch(body)
    # Заголовок
    hdr = FancyBboxPatch((x, y - 0.45), w, 0.45,
                         boxstyle="square,pad=0", fc=title_fc, ec=ec, lw=0, zorder=4)
    ax.add_patch(hdr)
    ax.text(x + w/2, y - 0.225, title, ha="center", va="center",
            fontsize=9, fontweight="bold", color="white", zorder=5)
    # Иконка компонента (прямоугольник с выступами)
    ic_x, ic_y = x + w - 0.35, y - 0.225
    ic = FancyBboxPatch((ic_x - 0.18, ic_y - 0.12), 0.22, 0.24,
                        boxstyle="square,pad=0", fc="white", ec="white", lw=0, zorder=6)
    ax.add_patch(ic)
    for dy in [-0.06, 0.04]:
        nub = FancyBboxPatch((ic_x - 0.22, ic_y + dy), 0.08, 0.07,
                             boxstyle="square,pad=0", fc="white", ec="white", lw=0, zorder=7)
        ax.add_patch(nub)
    # Пункты
    for i, item in enumerate(items):
        iy = y - 0.65 - i * 0.38
        ax.plot(x + 0.18, iy, "o", color=ec, ms=4, zorder=5)
        ax.text(x + 0.35, iy, item, va="center", fontsize=8, color=C_TEXT, zorder=5)


def dep_arrow(ax, x1, y1, x2, y2, label="", color="#94A3B8"):
    ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle="-|>", color=color, lw=1.5,
                                connectionstyle="arc3,rad=0"), zorder=2)
    if label:
        mx, my = (x1+x2)/2, (y1+y2)/2
        ax.text(mx, my + 0.1, label, ha="center", fontsize=7.5, color=color,
                bbox=dict(fc="white", ec="none", pad=1))


def draw_components():
    fig, ax = plt.subplots(figsize=(16, 10))
    ax.set_xlim(0, 16); ax.set_ylim(0, 10)
    ax.axis("off")
    fig.patch.set_facecolor("white")

    # ── Слои-подложки ─────────────────────────────────────────────────────
    for (x, y, w, h, label, fc, ec) in [
        (0.2, 9.8, 5.6, 9.3, "Клиентский уровень",     "#EFF6FF", "#BFDBFE"),
        (6.2, 9.8, 5.6, 9.3, "Серверный уровень",      "#F0FDF4", "#BBF7D0"),
        (12.2,9.8, 3.6, 9.3, "Уровень данных / AI",    "#FFF7ED", "#FED7AA"),
    ]:
        zone = FancyBboxPatch((x, y - h), w, h,
                              boxstyle="round,pad=0.1", fc=fc, ec=ec,
                              lw=2, ls="--", zorder=1)
        ax.add_patch(zone)
        ax.text(x + w/2, y - 0.2, label, ha="center", fontsize=9,
                color=ec, fontweight="bold", style="italic")

    # ── Клиентские компоненты ─────────────────────────────────────────────
    component_box(ax, 0.4, 9.2, 5.2, 2.0, "UI-компоненты (shadcn/ui)",
                  ["Кнопки, формы, карточки", "Sidebar, таблицы", "Toast-уведомления"],
                  C_LBLUE, C_BLUE)

    component_box(ax, 0.4, 6.8, 5.2, 2.0, "Страницы (React + Wouter)",
                  ["TeacherDashboard / StudentDashboard", "TestCreate / TestTake / Results",
                   "MyResults / MyProgress / AiAnalysis"],
                  C_LBLUE, C_BLUE)

    component_box(ax, 0.4, 4.4, 5.2, 1.6, "Состояние (TanStack Query)",
                  ["Кэш HTTP-запросов", "Мутации (POST/PUT/DELETE)", "Авто-инвалидация кэша"],
                  C_LBLUE, C_BLUE)

    component_box(ax, 0.4, 2.5, 5.2, 1.6, "Аутентификация (AuthContext)",
                  ["useAuth() хук", "Сессия пользователя", "ProtectedRoute"],
                  C_LBLUE, C_BLUE)

    # ── Серверные компоненты ──────────────────────────────────────────────
    component_box(ax, 6.4, 9.2, 5.2, 2.0, "REST API (Express.js)",
                  ["Маршруты /api/*", "requireAuth / requireTeacher", "Обработка ошибок"],
                  C_LGREEN, C_GREEN)

    component_box(ax, 6.4, 6.8, 5.2, 2.0, "Бизнес-логика",
                  ["Проверка тестов", "Расчёт баллов", "Статистика и аналитика"],
                  C_LGREEN, C_GREEN)

    component_box(ax, 6.4, 4.4, 5.2, 1.6, "AI-модуль (evaluateWithAI)",
                  ["Промпт-инжиниринг", "Запрос к Groq API", "Разбор JSON-ответа"],
                  C_LGREEN, C_GREEN)

    component_box(ax, 6.4, 2.5, 5.2, 1.6, "Сессии (express-session)",
                  ["MemoryStore", "bcrypt-хэширование паролей", "Cookie-управление"],
                  C_LGREEN, C_GREEN)

    # ── Данные / AI ───────────────────────────────────────────────────────
    component_box(ax, 12.4, 9.2, 3.2, 2.0, "Drizzle ORM",
                  ["Типизированные запросы", "Схема таблиц", "Миграции"],
                  C_LORAN, C_ORANGE)

    component_box(ax, 12.4, 6.8, 3.2, 1.6, "SQLite (better-sqlite3)",
                  ["WAL-режим", "Локальный файл .db", "Foreign keys ON"],
                  C_LORAN, C_ORANGE)

    component_box(ax, 12.4, 4.8, 3.2, 1.8, "Groq API",
                  ["Llama 3.3-70B", "JSON-mode ответы", "REST HTTPS"],
                  C_LPUR, "#7C3AED")

    # ── Стрелки зависимостей ──────────────────────────────────────────────
    dep_arrow(ax, 5.6, 7.5, 6.4, 7.5, "HTTP/JSON", C_GRAY)
    dep_arrow(ax, 11.6, 7.5, 12.4, 7.5, "SQL", C_ORANGE)
    dep_arrow(ax, 8.0, 4.4, 8.0, 2.9, "", C_GREEN)
    dep_arrow(ax, 9.2, 3.6, 12.4, 4.0, "HTTPS", "#7C3AED")
    dep_arrow(ax, 8.0, 6.8, 8.0, 5.2, "", C_GREEN)
    dep_arrow(ax, 3.0, 4.4, 3.0, 2.9, "", C_BLUE)
    dep_arrow(ax, 3.0, 6.8, 3.0, 5.2, "", C_BLUE)

    plt.tight_layout()
    path = os.path.join(OUT, "diagram_components.png")
    plt.savefig(path, dpi=180, bbox_inches="tight", facecolor="white")
    plt.close()
    print(f"Сохранено: {path}")


if __name__ == "__main__":
    draw_usecase()
    draw_components()
    print("\nГотово!")
