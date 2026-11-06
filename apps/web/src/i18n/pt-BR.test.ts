import { ERROR_CODES, ROLES } from '@az-pesquisas/contracts';
import { describe, expect, it } from 'vitest';

import { errorMessage, t } from './pt-BR';

describe('pt-BR texts (rule 13)', () => {
  it.each(ERROR_CODES)('translates the API error code %s', (code) => {
    const message = errorMessage(code);

    expect(message).not.toBe(code);
    expect(message.length).toBeGreaterThan(5);
  });

  it('falls back to a generic message for codes it does not know', () => {
    expect(errorMessage('SOMETHING_NEW')).toBe(t.errors.generic);
    expect(errorMessage(undefined)).toBe(t.errors.generic);
  });

  it.each(ROLES)('has a label for the role %s', (role) => {
    expect(t.roles[role]).toMatch(/^[A-ZÁ-Ú]/);
  });

  it('keeps the login error generic, with the lockout hint (spec 005 rule 8)', () => {
    expect(errorMessage('INVALID_CREDENTIALS')).toContain('E-mail ou senha incorretos');
    expect(t.login.lockoutHint).toContain('15 minutos');
  });
});

describe('t.home.greeting', () => {
  it('greets by first name', () => {
    expect(t.home.greeting('Ana Maria Souza')).toBe('Olá, Ana!');
  });
});

describe('plural and template texts (spec 013)', () => {
  it.each([
    [t.clients.count, 'cliente', 'clientes'],
    [t.surveys.count, 'pesquisa', 'pesquisas'],
    [t.surveys.municipalityCount, '1 município', '3 municípios'],
  ])('pluralizes', (fn, one, many) => {
    expect(fn(1)).toBe(one);
    expect(fn(3)).toBe(many);
  });

  it('counts chosen municipalities and names things', () => {
    expect(t.surveys.fields.municipalitySelected(0)).toBe('Nenhum município escolhido');
    expect(t.surveys.fields.municipalitySelected(1)).toBe('1 escolhido');
    expect(t.surveys.fields.municipalitySelected(4)).toBe('4 escolhidos');
    expect(t.surveys.fields.municipalityRemove('Itambé')).toBe('Remover Itambé');
    expect(t.clients.deleteTitle('Cliente X')).toBe('Excluir Cliente X?');
  });

  it('has labels for every survey type, status and collection mode', () => {
    expect(Object.values(t.surveyTypes)).toHaveLength(5);
    expect(Object.values(t.surveyStatuses)).toHaveLength(4);
    expect(t.gpsModes.required).toBe('Obrigatório');
    expect(t.audioModes.on).toBe('Ligada');
  });
});

describe('questionnaire texts (spec 014)', () => {
  it('pluralizes and names', () => {
    const q = t.questionnaire;
    expect(q.questions(1)).toBe('1 pergunta');
    expect(q.questions(2)).toBe('2 perguntas');
    expect(q.issues.title(1)).toBe('1 pendência para publicar');
    expect(q.issues.title(3)).toBe('3 pendências para publicar');
    expect(q.moveUp('P01')).toBe('Subir P01');
    expect(q.moveDown('P01')).toBe('Descer P01');
    expect(q.drag('P01')).toBe('Arrastar P01');
    expect(q.removeConfirm('P01')).toContain('P01');
    expect(q.items.position(2)).toBe('Item 2');
  });

  it('labels every question type, operator and pending issue', () => {
    expect(Object.keys(t.questionTypes)).toHaveLength(10);
    expect(Object.keys(t.operators)).toHaveLength(10);
    expect(Object.values(t.lint).every((text) => text.length > 0)).toBe(true);
  });
});

describe('profile block texts (spec 014, change 1)', () => {
  it('counts inserted questions and names the variable', () => {
    expect(t.profileBlocks.inserted(1)).toBe('1 pergunta inserida.');
    expect(t.profileBlocks.inserted(7)).toBe('7 perguntas inseridas.');
    expect(t.profileBlocks.badge(t.profiles.sex)).toBe('Variável de perfil: Sexo');
    expect(Object.keys(t.profiles)).toHaveLength(7);
  });
});

describe('publication and versions texts (spec 015)', () => {
  it('names versions and counts', () => {
    expect(t.publication.publish(2)).toBe('Publicar versão 2');
    expect(t.publication.published(0)).toBe('Nunca publicado');
    expect(t.publication.published(3)).toBe('Publicado: versão 3');
    expect(t.publication.title(1)).toBe('Publicar a versão 1?');
    expect(t.publication.done(1)).toBe('Versão 1 publicada.');
    expect(t.versions.version(4)).toBe('Versão 4');
    expect(t.versions.questions(1)).toBe('1 pergunta');
    expect(t.versions.questions(5)).toBe('5 perguntas');
    expect(t.versions.rank(3)).toBe('Ordenar as 3 primeiras');
    expect(t.versions.rank(undefined)).toBe('Ordenar todas');
    expect(t.versions.selections(1, undefined)).toBe('Mínimo 1 marcação(ões)');
    expect(t.versions.selections(1, 3)).toBe('De 1 a 3 marcações');
    expect(t.versions.generated('01/01/2026')).toContain('01/01/2026');
    expect(t.changeKinds.question_code('P1')).toBe('P1: código  → ');
    expect(t.changeKinds.item_text('P1')).toBe('P1: rótulo alterado para ""');
  });
});
