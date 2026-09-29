/* ============================================================
   AI 判分接口配置模板
   使用方法：复制本文件为 js/config.js，按需修改。
   js/config.js 已加入 .gitignore，不会提交到 Git，密钥只留在本地。
   ============================================================ */
window.APP_CONFIG = {
  // true = 使用本地模拟评分引擎（无需任何 API Key，离线可用）
  // false = 调用下方真实 AI 接口判分（需自行填写 endpoint/model/apiKey）
  mockMode: true,

  api: {
    // 任意 OpenAI 兼容的 chat/completions 接口。
    // 免费/低价第三方方案举例（请自行确认各平台最新计费与条款）：
    //   DeepSeek  https://api.deepseek.com/v1/chat/completions
    //   智谱 GLM  https://open.bigmodel.cn/api/paas/v4/chat/completions
    //   通义千问  https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions
    //   Gemini    https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
    //   OpenRouter https://openrouter.ai/api/v1/chat/completions（含免费模型）
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    apiKey: "", // 密钥仅保存在本地 js/config.js，切勿提交 Git
    temperature: 0.3,
    timeoutMs: 60000
  }
};
