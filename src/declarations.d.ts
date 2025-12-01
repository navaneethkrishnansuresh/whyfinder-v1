// Allow importing .txt files as strings
declare module '*.txt' {
  const content: string;
  export default content;
}

