import { createApp } from './app.factory.js';
import { loadConfig } from './shared/config/app-config.js';

const bootstrap = async (): Promise<void> => {
  const config = loadConfig(process.env);
  if (!config.ok) {
    // The logger depends on a valid config, so this one message goes straight to stderr.
    process.stderr.write(`${config.error.message}\n`);
    process.exit(1);
  }

  const app = await createApp(config.value);
  await app.listen({ port: config.value.port, host: config.value.host });
};

void bootstrap();
