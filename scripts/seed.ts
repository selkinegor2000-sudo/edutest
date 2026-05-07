import { rebuildDemoContour } from "../server/demo-seed";

async function seed() {
  console.log("🌱 Начинаю заполнение базы данных...");

  const result = await rebuildDemoContour();
  console.log(`  ✓ Пользователи: ${result.usersCreated}`);
  console.log(`  ✓ Тесты: ${result.testsCreated}`);
  console.log(`  ✓ Вопросы: ${result.questionsCreated}`);
  console.log(`  ✓ Попытки: ${result.createdAttempts}`);
  console.log(`  ✓ Группы: ${result.createdGroups}`);
  console.log(`  ✓ Назначения: ${result.createdAssignments}`);
  console.log(`  ✓ Материалы: ${result.createdMaterials}`);
  console.log(`  ✓ Сообщения: ${result.createdMessages}`);
  console.log(`  ✓ Уведомления: ${result.createdNotifications}`);
  console.log("\n✅ Демо-контур успешно восстановлен!");
}

seed().catch((e) => { console.error(e); process.exit(1); });
