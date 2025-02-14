#!/usr/bin/env node

import path from 'path';
import fs from 'fs/promises';
import crypto from  'crypto';
import { diffLines } from 'diff';
import chalk from 'chalk';
import {Command} from 'commander';

const program = new Command();


class GitNova{
    constructor(repoPath = '.'){
        this.repoPath = path.join(repoPath,'.gitnova');
        this.objectsPath = path.join(this.repoPath,'objects');
        this.headPath = path.join(this.repoPath,'HEAD');
        this.indexPath = path.join(this.repoPath,'index');
        this.init();
    }
    async init(){
        await fs.mkdir(this.objectsPath,{recursive:true});
        try{
            await fs.writeFile(this.headPath,'',{flag:'wx'});
            await fs.writeFile(this.indexPath,JSON.stringify([]),{flag:'wx'});
            
        }catch(error){
            console.log('Already initialized the .gitnova folder');
        }
    }
    hashObject(content){
        return crypto.createHash('sha1').update(content,'utf-8').digest('hex');
    }

    async add(fileToBeAdded){
        const fileData = await fs.readFile(fileToBeAdded,{encoding:'utf-8'});
        const fileHash = this.hashObject(fileData);
        console.log(fileHash);
        const newFileHashObjectPath = path.join(this.objectsPath,fileHash);
        await fs.writeFile(newFileHashObjectPath,fileData);
        await this.updateStagingArea(fileToBeAdded,fileHash);
        console.log(`Added ${fileToBeAdded}`);
    }

    async updateStagingArea(filePath,fileHash){
        const index = JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'}));
        index.push({path:filePath,hash:fileHash});
        await fs.writeFile(this.indexPath,JSON.stringify(index));
    }

    async commit(message){
        const index = JSON.parse(await fs.readFile(this.indexPath,{encoding:'utf-8'}));
        // console.log("Index: ",index);

        const parentCommit = await this.getCurrentHead();

        const commitData = {
            timeStamp:new Date().toISOString(),
            message,
            files:index,
            parent:parentCommit
        };

        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath,commitHash);
        await fs.writeFile(commitPath,JSON.stringify(commitData));
        await fs.writeFile(this.headPath,commitHash);
        await fs.writeFile(this.indexPath,JSON.stringify([]));
        console.log(`Commit successfully created ${commitHash}`);


    }

    async getCurrentHead(){
        try{
            return await fs.readFile(this.headPath,{encoding:'utf-8'});
        }catch(error){
            return null;
        }
    }

    async log(){
        let currentCommitHash = await this.getCurrentHead();
        // console.log(currentCommitHash);
        while(currentCommitHash){
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath,currentCommitHash),{encoding:'utf-8'}));
            console.log(`Commit: ${currentCommitHash}\nDate:${commitData.timeStamp}\n\n${commitData.message}\n\n`);
            currentCommitHash = commitData.parent;
        }
    }

    async showCommitDiff(commitHash){
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if(!commitData){
            console.log("commit not found");
            return;
        }
        console.log("Changes in the last commit are: ");
        
        for(const file of commitData.files){
            console.log(`File: ${file.path}`);
            const fileContent = await this.getFileContent(file.hash);
            console.log(fileContent);
            if(commitData.parent){
                const parentCommitData = JSON.parse(await this.getCommitData(commitData.parent));
                const getParentFileContent = await this.getParentFileContent(parentCommitData,file.path);
                if(getParentFileContent!=undefined){
                    console.log("Diff");
                    const diff  = diffLines(getParentFileContent,fileContent);
                    diff.forEach(part=>{
                        if(part.added){
                            process.stdout.write(chalk.green("++" + part.value));
                        }else if(part.removed){
                            process.stdout.write(chalk.red("--" + part.value));
                        }else{
                            process.stdout.write(chalk.grey(part.value));
                        }
                    })
                    console.log();
                }else{
                    console.log("New file in this commit");
                }
            }else{
                console.log("First commit");
            }
        }
    }

    async getParentFileContent(parentCommitData, filePath){
        const parentFile = parentCommitData.files.find(file=>filePath===path);
        if(parentFile){
            return await this.getFileContent(parentFile.hash);
        }
    }

    async getCommitData(commitHash){
        const commitPath = path.join(this.objectsPath,commitHash);
        try {
            return await fs.readFile(commitPath,{encoding:'utf-8'});
        } catch (error) {
            console.log("Failed to read the commit data,",error);
            return null;
        }
    }

    async getFileContent(fileHash){
        const objectPath = path.join(this.objectsPath,fileHash);
        return await fs.readFile(objectPath,{encoding:'utf-8'});
    }
}


// (async ()=>{
//     const gitnova = new GitNova();
//     await gitnova.add('sample.txt');
//     await gitnova.commit('Second commit');
//     await gitnova.log();
// })();

program.command('init').action(async ()=>{
    const gitnova = new GitNova();
});

program.command('add <file>').action(async (file)=>{
    const gitnova = new GitNova();
    await gitnova.add(file);
});

program.command('commit <message>').action(async (message)=>{
    const gitnova = new GitNova();
    await gitnova.commit(message);
});

program.command('log').action(async ()=>{
    const gitnova = new GitNova();
    await gitnova.log();
});

program.command('show <commitHash>').action(async (commitHash)=>{
    const gitnova = new GitNova();
    await gitnova.showCommitDiff(commitHash);
});

// console.log(process.argv);

program.parse(process.argv);

