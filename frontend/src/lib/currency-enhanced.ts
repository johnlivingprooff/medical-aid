/**
 * Enhanced Currency Utilities for Medical Aid System
 * Handles decimal precision for financial calculations
 */

export interface MonetaryAmount {
  amount: string;
  currency: 'MWK';
  precision: number;
}

export class CurrencyUtils {
  private static readonly DEFAULT_CURRENCY = 'MWK';
  private static readonly DEFAULT_PRECISION = 2;
  
  /**
   * Format a decimal string as currency
   */
  static format(amount: string | number, currency = this.DEFAULT_CURRENCY): string {
    if (!amount || amount === '') return `${currency} 0.00`;
    
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    if (isNaN(numericAmount)) return `${currency} 0.00`;
    
    return new Intl.NumberFormat('en-MW', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: this.DEFAULT_PRECISION,
      maximumFractionDigits: this.DEFAULT_PRECISION,
    }).format(numericAmount);
  }

  /**
   * Validate if a string represents a valid decimal amount
   */
  static isValidDecimal(amount: string): boolean {
    if (!amount || amount.trim() === '') return false;
    
    // Check for valid decimal format (up to 12 digits, 2 decimal places)
    const decimalRegex = /^\d{1,10}(\.\d{0,2})?$/;
    return decimalRegex.test(amount.trim());
  }

  /**
   * Parse and validate decimal string
   */
  static parseDecimal(amount: string): { value: string; isValid: boolean; error?: string } {
    if (!amount || amount.trim() === '') {
      return { value: '0.00', isValid: false, error: 'Amount is required' };
    }

    const trimmed = amount.trim();
    
    if (!this.isValidDecimal(trimmed)) {
      return {
        value: trimmed,
        isValid: false,
        error: 'Invalid amount format. Use format: 1234.56'
      };
    }

    // Ensure two decimal places
    const parsed = parseFloat(trimmed);
    const formatted = parsed.toFixed(2);
    
    return {
      value: formatted,
      isValid: true
    };
  }

  /**
   * Calculate medical aid specific financial components
   */
  static calculatePatientResponsibility(
    claimAmount: string,
    deductible: string = '0.00',
    copaymentFixed: string = '0.00',
    copaymentPercentage: string = '0.00'
  ): {
    claimAmount: string;
    deductible: string;
    afterDeductible: string;
    copaymentFixed: string;
    copaymentPercentage: string;
    totalCopayment: string;
    patientTotal: string;
    schemePayable: string;
  } {
    const claim = parseFloat(claimAmount) || 0;
    const deduct = Math.min(parseFloat(deductible) || 0, claim);
    const afterDeduct = claim - deduct;
    
    const copayFixed = parseFloat(copaymentFixed) || 0;
    const copayPercent = (afterDeduct * (parseFloat(copaymentPercentage) || 0)) / 100;
    const totalCopay = copayFixed + copayPercent;
    const patientTotal = deduct + totalCopay;
    const schemePayable = Math.max(0, claim - patientTotal);

    return {
      claimAmount: claim.toFixed(2),
      deductible: deduct.toFixed(2),
      afterDeductible: afterDeduct.toFixed(2),
      copaymentFixed: copayFixed.toFixed(2),
      copaymentPercentage: copayPercent.toFixed(2),
      totalCopayment: totalCopay.toFixed(2),
      patientTotal: patientTotal.toFixed(2),
      schemePayable: schemePayable.toFixed(2)
    };
  }

  /**
   * Format financial breakdown for display
   */
  static formatFinancialBreakdown(breakdown: ReturnType<typeof CurrencyUtils.calculatePatientResponsibility>): {
    display: string;
    components: Array<{ label: string; amount: string; type: 'positive' | 'negative' | 'neutral' }>;
  } {
    const components = [
      { label: 'Claim Amount', amount: this.format(breakdown.claimAmount), type: 'neutral' as const },
      { label: 'Deductible', amount: this.format(breakdown.deductible), type: 'negative' as const },
      { label: 'Fixed Copayment', amount: this.format(breakdown.copaymentFixed), type: 'negative' as const },
      { label: 'Percentage Copayment', amount: this.format(breakdown.copaymentPercentage), type: 'negative' as const },
      { label: 'Patient Responsibility', amount: this.format(breakdown.patientTotal), type: 'negative' as const },
      { label: 'Scheme Payable', amount: this.format(breakdown.schemePayable), type: 'positive' as const }
    ].filter(item => parseFloat(item.amount.replace(/[^\d.-]/g, '')) > 0);

    return {
      display: `Scheme pays ${this.format(breakdown.schemePayable)} of ${this.format(breakdown.claimAmount)}`,
      components
    };
  }

  /**
   * Validate claim amount against benefit limits
   */
  static validateAgainstBenefits(
    claimAmount: string,
    benefitCoverage?: string,
    benefitUsed?: string,
    benefitLimit?: number,
    benefitUsedCount?: number
  ): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
    remainingCoverage?: string;
    remainingCount?: number;
  } {
    const warnings: string[] = [];
    const errors: string[] = [];
    let isValid = true;

    const claim = parseFloat(claimAmount) || 0;
    
    // Check coverage amount limits
    if (benefitCoverage && benefitUsed) {
      const coverage = parseFloat(benefitCoverage);
      const used = parseFloat(benefitUsed);
      const remaining = coverage - used;
      
      if (claim > remaining) {
        errors.push(`Claim amount ${this.format(claimAmount)} exceeds remaining coverage ${this.format(remaining.toFixed(2))}`);
        isValid = false;
      } else if (claim > remaining * 0.8) {
        warnings.push(`Claim will use ${Math.round((claim / remaining) * 100)}% of remaining coverage`);
      }
    }

    // Check count limits
    if (benefitLimit && benefitUsedCount !== undefined) {
      const remainingCount = benefitLimit - benefitUsedCount;
      if (remainingCount <= 0) {
        errors.push('Benefit usage limit reached for this period');
        isValid = false;
      } else if (remainingCount <= 2) {
        warnings.push(`Only ${remainingCount} claims remaining for this benefit`);
      }
    }

    return {
      isValid,
      warnings,
      errors,
      remainingCoverage: benefitCoverage && benefitUsed 
        ? Math.max(0, parseFloat(benefitCoverage) - parseFloat(benefitUsed)).toFixed(2)
        : undefined,
      remainingCount: benefitLimit && benefitUsedCount !== undefined
        ? Math.max(0, benefitLimit - benefitUsedCount)
        : undefined
    };
  }
}

/**
 * Currency Input Component Helper
 */
export const createCurrencyInputProps = (
  value: string,
  onChange: (value: string) => void,
  options?: {
    placeholder?: string;
    required?: boolean;
    max?: string;
    min?: string;
  }
) => ({
  type: 'text',
  inputMode: 'decimal' as const,
  value,
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Allow only numbers and one decimal point
    const sanitized = input.replace(/[^0-9.]/g, '');
    // Prevent multiple decimal points
    const parts = sanitized.split('.');
    const formatted = parts.length > 2 
      ? parts[0] + '.' + parts.slice(1).join('') 
      : sanitized;
    
    onChange(formatted);
  },
  placeholder: options?.placeholder || '0.00',
  required: options?.required,
  max: options?.max,
  min: options?.min || '0',
  step: '0.01'
});

export default CurrencyUtils;