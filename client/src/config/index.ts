const getEnvVar = (key: string) => {
  if (import.meta.env[key] === undefined) {
    throw new Error(`Env variable ${key} is required`);
  }
  return import.meta.env[key] || '';
};

const WS_URL = getEnvVar('VITE_WS_URL');

export { WS_URL };
