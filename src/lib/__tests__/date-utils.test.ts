import { describe, it, expect } from 'vitest';
import { getWeekRange, getWeekDays, getDayIndex, previousWeek, nextWeek, formatWeekHeader } from '../date-utils';
import { getDay } from 'date-fns';

// ─── getWeekRange ─────────────────────────────────────────────────────
describe('getWeekRange', () => {
    it('deve retornar segunda como início e domingo como fim', () => {
        // Quarta-feira, 26 de Fev 2026
        const wednesday = new Date(2026, 1, 25);
        const { start, end } = getWeekRange(wednesday);

        // Início deve ser segunda-feira
        expect(getDay(start)).toBe(1); // 1 = Monday
        // Fim deve ser domingo
        expect(getDay(end)).toBe(0); // 0 = Sunday
    });

    it('deve retornar o mesmo intervalo para qualquer dia da mesma semana', () => {
        const monday = new Date(2026, 1, 23);
        const friday = new Date(2026, 1, 27);

        const mondayRange = getWeekRange(monday);
        const fridayRange = getWeekRange(friday);

        expect(mondayRange.start.getTime()).toBe(fridayRange.start.getTime());
        expect(mondayRange.end.getTime()).toBe(fridayRange.end.getTime());
    });
});

// ─── getWeekDays ──────────────────────────────────────────────────────
describe('getWeekDays', () => {
    it('deve retornar 7 dias', () => {
        const date = new Date(2026, 1, 25);
        const days = getWeekDays(date);
        expect(days).toHaveLength(7);
    });

    it('deve começar na segunda e terminar no domingo', () => {
        const date = new Date(2026, 1, 25);
        const days = getWeekDays(date);

        expect(getDay(days[0])).toBe(1); // Monday
        expect(getDay(days[6])).toBe(0); // Sunday
    });
});

// ─── getDayIndex ──────────────────────────────────────────────────────
describe('getDayIndex', () => {
    it('segunda-feira deve retornar 0', () => {
        const monday = new Date(2026, 1, 23);
        expect(getDayIndex(monday)).toBe(0);
    });

    it('sexta-feira deve retornar 4', () => {
        const friday = new Date(2026, 1, 27);
        expect(getDayIndex(friday)).toBe(4);
    });

    it('domingo deve retornar 6', () => {
        const sunday = new Date(2026, 2, 1);
        expect(getDayIndex(sunday)).toBe(6);
    });
});

// ─── previousWeek / nextWeek ──────────────────────────────────────────
describe('previousWeek / nextWeek', () => {
    it('deve navegar uma semana para trás', () => {
        const date = new Date(2026, 1, 25);
        const prev = previousWeek(date);
        expect(prev.getDate()).toBe(18);
    });

    it('deve navegar uma semana para frente', () => {
        const date = new Date(2026, 1, 25);
        const next = nextWeek(date);
        expect(next.getDate()).toBe(4); // March 4
    });
});

// ─── formatWeekHeader ─────────────────────────────────────────────────
describe('formatWeekHeader', () => {
    it('deve retornar header formatado com mês em português', () => {
        // A semana de 25/02/2026 vai de 23/02 (seg) a 01/03 (dom) 
        // formatWeekHeader usa o mês do FIM da semana
        const date = new Date(2026, 1, 25);
        const header = formatWeekHeader(date);
        // Deve conter "março" pois a semana termina em março
        expect(header.toLowerCase()).toContain('março');
        expect(header).toContain('2026');
    });

    it('deve retornar header com mês correto para semana inteira no mesmo mês', () => {
        // 10/03/2026 = semana 09-15 de março (toda no mesmo mês)
        const date = new Date(2026, 2, 10);
        const header = formatWeekHeader(date);
        expect(header.toLowerCase()).toContain('março');
    });
});
