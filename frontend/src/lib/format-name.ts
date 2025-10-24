/**
 * Utility function to format user's full name with proper capitalization
 * @param firstName - User's first name
 * @param lastName - User's last name
 * @returns Formatted full name with first letter capitalized
 */
export function formatFullName(firstName?: string, lastName?: string): string {
  const capitalize = (str: string) => {
    if (!str) return ''
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
  }

  const formattedFirst = capitalize(firstName || '')
  const formattedLast = capitalize(lastName || '')

  if (formattedFirst && formattedLast) {
    return `${formattedFirst} ${formattedLast}`
  }
  return formattedFirst || formattedLast || 'N/A'
}
