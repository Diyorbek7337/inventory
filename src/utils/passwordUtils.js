/**
 * Parol xavfsizligi uchun utility funksiyalar
 * bcryptjs - brauzerda ishlaydigan bcrypt implementatsiyasi
 */

import bcrypt from 'bcryptjs';

// Hash yaratish uchun "salt rounds" - qanchalik kuchli shifrlash
const SALT_ROUNDS = 10;

/**
 * Parolni hash qilish
 * @param {string} password - Oddiy parol
 * @returns {Promise<string>} - Hashlangan parol
 * 
 * Misol:
 * "123456" → "$2a$10$X7jG2kV8Q..."
 */
export const hashPassword = async (password) => {
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.error('Parol hash xatosi:', error);
    throw new Error('Parol shifrlashda xatolik');
  }
};

/**
 * Parolni tekshirish
 * @param {string} password - Foydalanuvchi kiritgan parol
 * @param {string} hashedPassword - Database'dagi hashlangan parol
 * @returns {Promise<boolean>} - Mos kelsa true
 * 
 * Misol:
 * verifyPassword("123456", "$2a$10$X7jG2...") → true
 * verifyPassword("wrongpass", "$2a$10$X7jG2...") → false
 */
export const verifyPassword = async (password, hashedPassword) => {
  try {
    // Agar eski format (hash qilinmagan) bo'lsa
    if (!hashedPassword.startsWith('$2')) {
      return password === hashedPassword;
    }
    
    const isMatch = await bcrypt.compare(password, hashedPassword);
    return isMatch;
  } catch (error) {
    console.error('Parol tekshirish xatosi:', error);
    return false;
  }
};

/**
 * Parol kuchliligini tekshirish
 * @param {string} password - Tekshiriladigan parol
 * @returns {object} - { isValid, score, message }
 */
export const checkPasswordStrength = (password) => {
  const result = {
    isValid: false,
    score: 0,
    message: '',
    suggestions: []
  };

  if (!password) {
    result.message = 'Parol kiritilmagan';
    return result;
  }

  // Uzunlik tekshirish
  if (password.length < 4) {
    result.message = 'Parol juda qisqa';
    result.suggestions.push('Kamida 4 ta belgi kiriting');
    return result;
  }

  let score = 0;

  // Uzunlik bo'yicha ball
  if (password.length >= 4) score += 1;
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;

  // Raqam bor
  if (/\d/.test(password)) score += 1;

  // Katta harf bor
  if (/[A-Z]/.test(password)) score += 1;

  // Kichik harf bor
  if (/[a-z]/.test(password)) score += 1;

  // Maxsus belgi bor
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

  result.score = score;
  result.isValid = score >= 2; // Minimal 2 ball

  if (score <= 2) {
    result.message = 'Kuchsiz parol';
  } else if (score <= 4) {
    result.message = 'O\'rtacha parol';
  } else if (score <= 6) {
    result.message = 'Yaxshi parol';
  } else {
    result.message = 'Juda kuchli parol';
  }

  // Tavsiyalar
  if (password.length < 8) {
    result.suggestions.push('8+ belgi ishlating');
  }
  if (!/\d/.test(password)) {
    result.suggestions.push('Raqam qo\'shing');
  }
  if (!/[A-Z]/.test(password)) {
    result.suggestions.push('Katta harf qo\'shing');
  }

  return result;
};

/**
 * Tasodifiy parol generatsiya qilish
 * @param {number} length - Parol uzunligi
 * @returns {string} - Yangi parol
 */
export const generatePassword = (length = 8) => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%&*';
  
  const allChars = lowercase + uppercase + numbers + symbols;
  
  let password = '';
  
  // Har bir turdan kamida bitta
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];
  
  // Qolgan belgilar
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // Aralashtirib yuborish
  return password.split('').sort(() => Math.random() - 0.5).join('');
};
