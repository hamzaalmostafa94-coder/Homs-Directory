import { useState, useEffect } from 'react';

function TypewriterGreeting() {
  const fullText = "تعبت وأنت عم تدوّر على (دكتور أو عيادة؟ / مصلّح أو فني صيانة؟ / محل تجاري أو سوبرماركت؟ ...) كل اللي عليك تبحث بـ «دليل مدينة حمص» لتلاقي رقم التواصل والموقع بدقة وبكبسة زر!";
  
 
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < fullText.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + fullText[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, 45); 

      
      return () => clearTimeout(timeout);
    }
  }, [currentIndex, fullText]);

  return (
    <div>
      <p>{displayedText}</p>
    </div>
  );
}

export default TypewriterGreeting;