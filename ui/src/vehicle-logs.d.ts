declare module 'virtual:vehicle-logs' {
  const logs: {
    csv: Array<{ name: string; text: string }>;
    scan: Array<{ name: string; text: string }>;
  };
  export default logs;
}
