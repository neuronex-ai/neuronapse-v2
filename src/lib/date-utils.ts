import { 
  startOfWeek, 
  endOfWeek, 
  addWeeks, 
  subWeeks, 
  format, 
  eachDayOfInterval,
  isSameDay,
  isToday,
  getDay,
  startOfDay,
  endOfDay
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Define o início da semana como Segunda-feira (1)
const weekOptions = { locale: ptBR, weekStartsOn: 1 as const };

/**
 * Retorna o intervalo de datas (início e fim) para a semana de uma data fornecida.
 */
export const getWeekRange = (date: Date) => {
  const start = startOfWeek(date, weekOptions);
  const end = endOfWeek(date, weekOptions);
  return { start, end };
};

/**
 * Retorna uma string formatada para o cabeçalho da semana (ex: 22 - 28 de Outubro, 2025).
 */
export const formatWeekHeader = (date: Date) => {
  const { start, end } = getWeekRange(date);
  
  const startDay = format(start, 'dd', { locale: ptBR });
  const endDay = format(end, 'dd', { locale: ptBR });
  const monthYear = format(end, 'MMMM, yyyy', { locale: ptBR });

  return `${startDay} - ${endDay} de ${monthYear}`;
};

/**
 * Retorna um array de objetos de data para cada dia da semana.
 */
export const getWeekDays = (date: Date) => {
  const { start, end } = getWeekRange(date);
  return eachDayOfInterval({ start, end });
};

/**
 * Navega para a semana anterior.
 */
export const previousWeek = (date: Date) => subWeeks(date, 1);

/**
 * Navega para a próxima semana.
 */
export const nextWeek = (date: Date) => addWeeks(date, 1);

/**
 * Retorna o índice do dia da semana (0=Dom, 1=Seg, ..., 6=Sáb).
 * Ajustado para começar em 0=Segunda-feira para o nosso grid (0-6).
 */
export const getDayIndex = (date: Date) => {
  const day = getDay(date);
  // Se for Domingo (0), retorna 6. Caso contrário, retorna day - 1.
  return day === 0 ? 6 : day - 1;
};

export { isSameDay, isToday, startOfDay, endOfDay };