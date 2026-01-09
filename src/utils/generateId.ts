export const generateId = (short: boolean = false): string => {
    const chars = "0123456789abcdef",
          length = short ? 12 : 64;

    let result = "";

    for(let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * chars.length);

        result += chars[randomIndex];
    }

    return result;
};
