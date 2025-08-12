'use client'
import { motion } from 'framer-motion'
import { Wrench, ShoppingBag, ArrowRight, Instagram, Youtube, Mail } from 'lucide-react'
export default function Page(){return(
<div className='min-h-screen' id='home'>
<header className='sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/40 border-b border-white/10'>
 <div className='container'>
  <div className='flex h-16 items-center justify-between'>
   <a href='#home' className='flex items-center gap-2'>
    <div className='h-8 w-8 rounded-xl bg-white text-black grid place-items-center font-black'>BM</div>
    <span className='font-extrabold tracking-tight text-lg'>BreakMyWallet</span>
   </a>
   <nav className='hidden md:flex items-center gap-6 text-sm'>
    <a href='#media' className='hover:text-zinc-300'>Media</a>
    <a href='#drops' className='hover:text-zinc-300'>Shop</a>
    <a href='#contact' className='hover:text-zinc-300'>Contact</a>
   </nav>
   <a className='btn' href='#drops'><ShoppingBag className='h-4 w-4'/> Shop</a>
  </div>
 </div>
</header>
<section className='relative overflow-hidden'>
 <div className='absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(255,255,255,0.08),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(255,255,255,0.06),transparent_30%)]'/>
 <div className='container py-20'>
  <motion.h1 initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.5}} className='text-4xl sm:text-6xl font-extrabold tracking-tight'>
   Build fast. Break parts. <span className='text-zinc-300'>Tell the truth.</span>
  </motion.h1>
  <motion.p initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{duration:0.7}} className='mt-4 max-w-2xl text-zinc-300'>
   Minimal starter to prove deploy and DNS — we’ll wire Shopify & Klaviyo after launch.
  </motion.p>
  <div className='mt-8 flex flex-col sm:flex-row gap-3'>
   <a href='#media' className='btn'><Wrench className='h-5 w-5'/> Watch the Wrenching</a>
   <a href='#drops' className='btn-outline'>Latest Drops <ArrowRight className='h-4 w-4'/></a>
  </div>
 </div>
</section>
<section className='container py-16' id='contact'>
 <div className='card p-6'>
  <h3 className='text-2xl font-bold'>Stay in the loop</h3>
  <p className='text-zinc-300 mt-2'>Hook up your email provider later — for now this form is a placeholder.</p>
  <form onSubmit={(e)=>{e.preventDefault(); alert('Form placeholder — email to be wired.')}} className='mt-6 flex flex-col sm:flex-row gap-3'>
   <input type='email' required placeholder='you@fastmail.com' className='w-full rounded-xl bg-zinc-900/60 border border-white/10 px-4 py-3 outline-none focus:border-white/30'/>
   <button className='btn' type='submit'>Sign me up</button>
  </form>
  <div className='flex gap-4 mt-6 text-zinc-400'>
   <a href='https://instagram.com/breakmywallet' className='hover:text-white inline-flex items-center gap-2'><Instagram className='h-4 w-4'/>Instagram</a>
   <a href='https://youtube.com' className='hover:text-white inline-flex items-center gap-2'><Youtube className='h-4 w-4'/>YouTube</a>
   <a href='mailto:hello@breakmywallet.com' className='hover:text-white inline-flex items-center gap-2'><Mail className='h-4 w-4'/>Email</a>
  </div>
 </div>
</section>
<footer className='border-t border-white/10'>
 <div className='container py-10 text-sm text-zinc-400 flex items-center justify-between'>
  <div className='flex items-center gap-2'>
   <div className='h-6 w-6 rounded-md bg-white text-black grid place-items-center font-black'>BM</div>
   <span>BreakMyWallet</span>
  </div>
  <span>© {new Date().getFullYear()}</span>
 </div>
</footer>
</div> )}
