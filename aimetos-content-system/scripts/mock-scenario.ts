const scenario = process.argv[2] || process.env.MOCK_SCENARIO || "normal";
process.env.MOCK_SCENARIO = scenario;
const { runMockContentFlow, writeReport } = await import("../packages/core/src/pipeline.ts");
const report = await runMockContentFlow();
const path = writeReport(report, "data/exports/report-" + scenario + ".json");
console.log("Scenario " + scenario + " completed: " + path);
