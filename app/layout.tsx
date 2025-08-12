import './globals.css'
import type { Metadata } from 'next'
export const metadata: Metadata={title:'BreakMyWallet — Basic',description:'Basic landing to verify hosting & DNS.'}
export default function RootLayout({children}:{children:React.ReactNode}){
 return(<html lang='en'><body>{children}</body></html>) }
