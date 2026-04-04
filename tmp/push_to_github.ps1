$git = 'C:\Program Files\Git\bin\git.exe'
& $git config user.name "youssoufa-gif"
& $git config user.email "youssoufa-gif@users.noreply.github.com"
& $git init
& $git add .
& $git commit -m "Refonte v4.0 - Afnane Couture & Brothers"
& $git branch -M main
& $git remote set-url origin https://github.com/youssoufa-gif/Afnane-Couture-and-Brothers.git
& $git push -u origin main --force
