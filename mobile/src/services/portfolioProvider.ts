import {SavedInvestment} from '../types';

export interface AuthorizedPortfolioProvider {
  getInvestments(): Promise<readonly SavedInvestment[]>;
}

export const PORTFOLIO_SOURCE_STATUS = {
  message: 'La consulta automática de inversiones personales no está disponible.',
} as const;
